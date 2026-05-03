import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getEndOfDayBangkokUTC,
    getGasActiveShiftDateRange,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
    toBangkokDateKey,
} from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { getGasStartBaselineLock } from '@/lib/gas/v2-workflow';

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

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station } = auth;

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);
        const activeShiftRange = getGasActiveShiftDateRange(today);

        const shiftInclude = {
            dailyRecord: true,
            staff: { select: { name: true } },
            meters: {
                orderBy: { nozzleNumber: 'asc' as const },
            },
            reconciliation: true,
        };

        const openShift = await prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: {
                    stationId: station.dbId,
                    date: {
                        gte: activeShiftRange.start,
                        lte: activeShiftRange.end,
                    },
                },
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { createdAt: 'desc' },
            ],
            include: shiftInclude,
        });

        const latestTodayShift = openShift ? null : await prisma.shift.findFirst({
            where: {
                dailyRecord: {
                    stationId: station.dbId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            },
            orderBy: [
                { shiftNumber: 'desc' },
                { createdAt: 'desc' },
            ],
            include: shiftInclude,
        });

        const shift = openShift ?? latestTodayShift;
        if (!shift) {
            return NextResponse.json({ shift: null });
        }

        // Get gauge readings for this shift
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.dbId,
                dailyRecordId: shift.dailyRecordId,
                shiftNumber: shift.shiftNumber,
            },
            orderBy: { tankNumber: 'asc' }
        });

        // Separate start and end gauge readings
        const startGauge = gaugeReadings.filter(g => g.notes === 'start');
        const endGauge = gaugeReadings.filter(g => g.notes === 'end');
        const transactionCount = await prisma.transaction.count({
            where: {
                shiftId: shift.id,
                deletedAt: null,
                isVoided: false,
            },
        });
        const startBaselineLock = getGasStartBaselineLock({
            shiftStatus: shift.status,
            transactionCount,
            hasEndMeters: shift.meters.some((meter) => meter.endReading !== null),
            hasEndGauges: endGauge.length > 0,
            hasReconciliation: Boolean(shift.reconciliation),
        });

        return NextResponse.json({
            shift: {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staffName: shift.staff?.name || null,
                openedAt: shift.createdAt,
                closedAt: shift.closedAt,
                businessDate: toBangkokDateKey(shift.dailyRecord.date),
                dateKey: toBangkokDateKey(shift.dailyRecord.date),
                meters: shift.meters.map(m => ({
                    nozzleNumber: m.nozzleNumber,
                    startReading: m.startReading !== null ? Number(m.startReading) : null,
                    endReading: m.endReading !== null ? Number(m.endReading) : null,
                    soldQty: m.soldQty !== null ? Number(m.soldQty) : null
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
                } : null,
                transactionCount,
                startBaselineLocked: startBaselineLock.locked,
                startBaselineLockReason: startBaselineLock.reason,
            }
        });
    } catch (error) {
        console.error('[Current Shift]:', error);
        return NextResponse.json({ error: 'Failed to fetch current shift' }, { status: 500 });
    }
}
