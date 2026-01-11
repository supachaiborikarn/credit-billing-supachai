import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

/**
 * GET /api/v2/gas/admin/reports/daily
 * Get daily aggregated reports for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');

        // Build date range
        const fromDate = from ? new Date(from + 'T00:00:00+07:00') : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            return d;
        })();
        const toDate = to ? new Date(to + 'T23:59:59+07:00') : new Date();

        // Get GAS station IDs (using both station-X and UUID aliases)
        const gasStations = STATIONS.filter(s => s.type === 'GAS');
        const gasStationIds: string[] = [];

        for (const station of gasStations) {
            gasStationIds.push(station.id);
            if ('aliases' in station && station.aliases) {
                const aliases = station.aliases as readonly string[];
                gasStationIds.push(...aliases);
            }
        }

        // Filter by stationId if provided
        let stationIds = gasStationIds;
        if (stationIdFilter && stationIdFilter !== 'all') {
            // If filter matches a station-X id, also include its aliases
            const matchedStation = gasStations.find(s => s.id === stationIdFilter);
            if (matchedStation && 'aliases' in matchedStation && matchedStation.aliases) {
                const aliases = matchedStation.aliases as readonly string[];
                stationIds = [stationIdFilter, ...aliases];
            } else {
                stationIds = [stationIdFilter];
            }
        }

        // Get daily records with shifts
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                stationId: { in: stationIds },
                date: {
                    gte: fromDate,
                    lte: toDate
                }
            },
            include: {
                station: true,
                shifts: {
                    include: {
                        meters: true,
                        reconciliation: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Aggregate by date
        const dayMap = new Map<string, {
            dateKey: string;
            displayDate: string;
            totalSales: number;
            totalLiters: number;
            transactionCount: number;
            shiftCount: number;
            cashAmount: number;
            creditAmount: number;
            cardAmount: number;
            transferAmount: number;
        }>();

        for (const record of dailyRecords) {
            const dateKey = record.date.toISOString().split('T')[0];
            const displayDate = record.date.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const existing = dayMap.get(dateKey) || {
                dateKey,
                displayDate,
                totalSales: 0,
                totalLiters: 0,
                transactionCount: 0,
                shiftCount: 0,
                cashAmount: 0,
                creditAmount: 0,
                cardAmount: 0,
                transferAmount: 0
            };

            // Calculate from shifts
            for (const shift of record.shifts) {
                existing.shiftCount++;

                // Calculate liters from meters
                const liters = shift.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0);
                existing.totalLiters += liters;

                // Get sales from reconciliation or calculate
                if (shift.reconciliation) {
                    existing.totalSales += Number(shift.reconciliation.totalReceived || 0);
                    existing.cashAmount += Number(shift.reconciliation.cashReceived || 0);
                    existing.creditAmount += Number(shift.reconciliation.creditReceived || 0);
                    existing.transferAmount += Number(shift.reconciliation.transferReceived || 0);
                } else {
                    // Calculate from liters * price
                    const gasPrice = Number(record.gasPrice || 16.09);
                    const estimated = liters * gasPrice;
                    existing.totalSales += estimated;
                    existing.cashAmount += estimated;
                }
            }

            dayMap.set(dateKey, existing);
        }

        // Convert to array and sort
        const days = Array.from(dayMap.values()).sort((a, b) =>
            b.dateKey.localeCompare(a.dateKey)
        );

        return NextResponse.json({ days });
    } catch (error) {
        console.error('[Daily Reports]:', error);
        return NextResponse.json({ error: 'Failed to fetch daily reports' }, { status: 500 });
    }
}
