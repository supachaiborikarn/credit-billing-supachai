import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

/**
 * GET /api/v2/gas/admin/reports/shift
 * Get shift reports for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');
        const shiftFilter = searchParams.get('shift');

        // Build date range
        const fromDate = from ? new Date(from + 'T00:00:00+07:00') : new Date();
        const toDate = to ? new Date(to + 'T23:59:59+07:00') : new Date();

        // Get GAS station IDs only
        const gasStationIds: string[] = [];
        for (const station of STATIONS) {
            if (station.type === 'GAS' && 'aliases' in station) {
                const aliases = station.aliases as readonly string[];
                if (aliases[0]) gasStationIds.push(aliases[0]);
            }
        }

        // Filter by stationId if provided
        const stationIds = stationIdFilter && stationIdFilter !== 'all'
            ? [stationIdFilter]
            : gasStationIds;

        // Get shifts with related data
        const shifts = await prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId: { in: stationIds },
                    date: {
                        gte: fromDate,
                        lte: toDate
                    }
                },
                ...(shiftFilter && shiftFilter !== 'all' && {
                    shiftNumber: parseInt(shiftFilter)
                })
            },
            include: {
                dailyRecord: {
                    include: {
                        station: true
                    }
                },
                staff: {
                    select: { name: true }
                },
                meters: {
                    orderBy: { nozzleNumber: 'asc' }
                },
                reconciliation: true
            },
            orderBy: [
                { createdAt: 'desc' }
            ]
        });

        // Format response
        const formattedShifts = shifts.map(shift => {
            // Calculate meter totals
            const nozzles = shift.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading || 0),
                endReading: Number(m.endReading || 0),
                soldQty: Number(m.soldQty || 0)
            }));
            const totalLiters = nozzles.reduce((sum, n) => sum + n.soldQty, 0);

            // Calculate sales from expected
            const gasPrice = Number(shift.dailyRecord.gasPrice || 16.09);
            const expectedSales = totalLiters * gasPrice;

            // Format date
            const date = shift.dailyRecord.date;
            const displayDate = date.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            return {
                id: shift.id,
                stationId: shift.dailyRecord.stationId,
                stationName: shift.dailyRecord.station?.name || 'Unknown',
                dateKey: date.toISOString().split('T')[0],
                displayDate,
                shiftNumber: shift.shiftNumber,
                staffName: shift.staff?.name || null,
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                status: shift.status,
                meters: {
                    total: totalLiters,
                    nozzles
                },
                sales: {
                    total: shift.reconciliation ? Number(shift.reconciliation.totalReceived) : expectedSales,
                    liters: totalLiters,
                    transactions: 0, // Would need to count transactions
                    cash: shift.reconciliation ? Number(shift.reconciliation.cashReceived) : expectedSales,
                    credit: shift.reconciliation ? Number(shift.reconciliation.creditReceived) : 0,
                    card: 0,
                    transfer: shift.reconciliation ? Number(shift.reconciliation.transferReceived) : 0
                },
                reconciliation: shift.reconciliation ? {
                    expected: Number(shift.reconciliation.totalExpected),
                    received: Number(shift.reconciliation.totalReceived),
                    variance: Number(shift.reconciliation.variance),
                    varianceStatus: Number(shift.reconciliation.variance) > 0 ? 'OVER' as const :
                        Number(shift.reconciliation.variance) < 0 ? 'SHORT' as const : 'BALANCED' as const
                } : null
            };
        });

        return NextResponse.json({ shifts: formattedShifts });
    } catch (error) {
        console.error('[Shift Reports]:', error);
        return NextResponse.json({ error: 'Failed to fetch shift reports' }, { status: 500 });
    }
}
