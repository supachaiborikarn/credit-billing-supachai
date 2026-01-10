import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayBangkok, getStartOfDayBangkokUTC, getEndOfDayBangkokUTC } from '@/lib/gas';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';

/**
 * GET /api/v2/gas/[stationId]/shift/current
 * Get current open shift or latest shift (GAS stations only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        // Find today's DailyRecord (use dbId for database queries)
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                shifts: {
                    orderBy: { shiftNumber: 'desc' },
                    take: 1,
                    include: {
                        staff: { select: { name: true } },
                        meters: {
                            orderBy: { nozzleNumber: 'asc' }
                        },
                        reconciliation: true
                    }
                }
            }
        });

        if (!dailyRecord || dailyRecord.shifts.length === 0) {
            return NextResponse.json({ shift: null });
        }

        const shift = dailyRecord.shifts[0];

        // Get gauge readings for this shift
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.dbId,
                shiftNumber: shift.shiftNumber,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            orderBy: { tankNumber: 'asc' }
        });

        // Separate start and end gauge readings
        const startGauge = gaugeReadings.filter(g => g.notes === 'start');
        const endGauge = gaugeReadings.filter(g => g.notes === 'end');

        return NextResponse.json({
            shift: {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staffName: shift.staff?.name || null,
                openedAt: shift.createdAt,
                closedAt: shift.closedAt,
                meters: shift.meters.map(m => ({
                    nozzleNumber: m.nozzleNumber,
                    startReading: m.startReading ? Number(m.startReading) : null,
                    endReading: m.endReading ? Number(m.endReading) : null,
                    soldQty: m.soldQty ? Number(m.soldQty) : null
                })),
                gauge: {
                    start: startGauge.map(g => ({
                        tankNumber: g.tankNumber,
                        percentage: Number(g.percentage)
                    })),
                    end: endGauge.map(g => ({
                        tankNumber: g.tankNumber,
                        percentage: Number(g.percentage)
                    }))
                },
                reconciliation: shift.reconciliation ? {
                    expected: Number(shift.reconciliation.totalExpected),
                    received: Number(shift.reconciliation.totalReceived),
                    variance: Number(shift.reconciliation.variance)
                } : null
            }
        });
    } catch (error) {
        console.error('[Current Shift]:', error);
        return NextResponse.json({ error: 'Failed to fetch current shift' }, { status: 500 });
    }
}
