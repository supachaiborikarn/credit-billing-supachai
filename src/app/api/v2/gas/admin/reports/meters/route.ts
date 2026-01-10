import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

/**
 * GET /api/v2/gas/admin/reports/meters
 * Get meter readings report for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');

        const fromDate = from ? new Date(from + 'T00:00:00+07:00') : new Date();
        const toDate = to ? new Date(to + 'T23:59:59+07:00') : new Date();

        // Get GAS station IDs
        const gasStationIds = STATIONS
            .filter(s => s.type === 'GAS')
            .map(s => s.id);

        const stationIds = stationIdFilter && stationIdFilter !== 'all'
            ? [stationIdFilter]
            : gasStationIds;

        // Get shifts with meter readings
        const shifts = await prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId: { in: stationIds },
                    date: {
                        gte: fromDate,
                        lte: toDate
                    }
                }
            },
            include: {
                dailyRecord: {
                    include: { station: true }
                },
                meters: {
                    orderBy: { nozzleNumber: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const meters = shifts.map(shift => {
            const nozzles = shift.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading || 0),
                endReading: Number(m.endReading || 0),
                soldQty: Number(m.soldQty || 0)
            }));
            const totalLiters = nozzles.reduce((sum, n) => sum + n.soldQty, 0);
            const gasPrice = Number(shift.dailyRecord.gasPrice || 16.09);

            return {
                date: shift.dailyRecord.date.toISOString().split('T')[0],
                displayDate: shift.dailyRecord.date.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                stationId: shift.dailyRecord.stationId,
                stationName: shift.dailyRecord.station?.name || 'Unknown',
                shiftNumber: shift.shiftNumber,
                nozzles,
                totalLiters,
                gasPrice,
                expectedSales: totalLiters * gasPrice
            };
        });

        return NextResponse.json({ meters });
    } catch (error) {
        console.error('[Meters Report]:', error);
        return NextResponse.json({ error: 'Failed to fetch meter reports' }, { status: 500 });
    }
}
