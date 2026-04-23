import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import {
    GAS_STALE_SHIFT_CONFIRMATION,
    appendStaleShiftNote,
    getGasStationIds,
    isStaleGasOpenShift,
} from '@/lib/gas/stale-shifts';

function parseCutoffDate(dateKey: string | null): Date {
    return getStartOfDayBangkok(dateKey || getTodayBangkok());
}

async function findStaleGasShifts(cutoffDate: Date, stationId?: string | null) {
    const gasStationIds = getGasStationIds();
    const stationIds = stationId && stationId !== 'all'
        ? [stationId]
        : gasStationIds;

    return prisma.shift.findMany({
        where: {
            status: 'OPEN',
            dailyRecord: {
                stationId: { in: stationIds },
                date: { lt: cutoffDate },
            },
        },
        include: {
            dailyRecord: {
                select: {
                    id: true,
                    stationId: true,
                    date: true,
                    station: { select: { name: true } },
                }
            },
            staff: { select: { name: true } },
            meters: true,
            transactions: {
                where: { deletedAt: null, isVoided: false },
                select: { id: true, amount: true, liters: true },
            },
        },
        orderBy: [
            { dailyRecord: { date: 'asc' } },
            { shiftNumber: 'asc' },
        ],
    }).then((shifts) => shifts.filter((shift) => isStaleGasOpenShift({
        stationId: shift.dailyRecord.stationId,
        status: shift.status,
        date: shift.dailyRecord.date,
    }, cutoffDate, gasStationIds)));
}

function formatShift(shift: Awaited<ReturnType<typeof findStaleGasShifts>>[number]) {
    return {
        id: shift.id,
        stationId: shift.dailyRecord.stationId,
        stationName: shift.dailyRecord.station?.name || shift.dailyRecord.stationId,
        date: shift.dailyRecord.date.toISOString(),
        shiftNumber: shift.shiftNumber,
        staffName: shift.staff?.name || null,
        createdAt: shift.createdAt,
        meterCount: shift.meters.length,
        missingEndMeterCount: shift.meters.filter((meter) => meter.endReading === null).length,
        transactionCount: shift.transactions.length,
        transactionAmount: shift.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
        transactionLiters: shift.transactions.reduce((sum, tx) => sum + Number(tx.liters), 0),
    };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const cutoffDate = parseCutoffDate(searchParams.get('beforeDate'));
        const stationId = searchParams.get('stationId');
        const staleShifts = await findStaleGasShifts(cutoffDate, stationId);

        return NextResponse.json({
            cutoffDate: cutoffDate.toISOString(),
            count: staleShifts.length,
            shifts: staleShifts.map(formatShift),
        });
    } catch (error) {
        console.error('[Gas Stale Shifts GET]:', error);
        return NextResponse.json({ error: 'Failed to list stale gas shifts' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const {
            beforeDate,
            stationId,
            dryRun = true,
            confirm,
        } = body;

        const cutoffDate = parseCutoffDate(beforeDate || null);
        const staleShifts = await findStaleGasShifts(cutoffDate, stationId);

        if (dryRun) {
            return NextResponse.json({
                dryRun: true,
                cutoffDate: cutoffDate.toISOString(),
                count: staleShifts.length,
                shifts: staleShifts.map(formatShift),
            });
        }

        if (confirm !== GAS_STALE_SHIFT_CONFIRMATION) {
            return NextResponse.json({
                error: `ต้องยืนยันด้วย confirm="${GAS_STALE_SHIFT_CONFIRMATION}" ก่อนปิดกะค้าง`
            }, { status: 400 });
        }

        const now = new Date();
        const cleanupNote = `auto-closed stale GAS shift before ${cutoffDate.toISOString()}`;

        const result = await prisma.$transaction(async (tx) => {
            const closedShiftIds: string[] = [];
            const touchedDailyRecordIds = new Set<string>();

            for (const shift of staleShifts) {
                for (const meter of shift.meters) {
                    if (meter.endReading === null) {
                        await tx.meterReading.update({
                            where: { id: meter.id },
                            data: {
                                endReading: meter.startReading,
                                soldQty: 0,
                            }
                        });
                    }
                }

                await tx.shift.update({
                    where: { id: shift.id },
                    data: {
                        status: 'CLOSED',
                        closedAt: now,
                        closedById: auth.user.id,
                        varianceNote: appendStaleShiftNote(shift.varianceNote, cleanupNote),
                    }
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: 'CLOSE',
                        model: 'Shift',
                        recordId: shift.id,
                        oldData: {
                            status: shift.status,
                            closedAt: shift.closedAt,
                            missingEndMeterCount: shift.meters.filter((meter) => meter.endReading === null).length,
                        },
                        newData: {
                            status: 'CLOSED',
                            closedAt: now.toISOString(),
                            source: 'admin-gas-stale-shifts',
                            cutoffDate: cutoffDate.toISOString(),
                        }
                    }
                });

                closedShiftIds.push(shift.id);
                touchedDailyRecordIds.add(shift.dailyRecordId);
            }

            for (const dailyRecordId of touchedDailyRecordIds) {
                const remainingOpen = await tx.shift.count({
                    where: { dailyRecordId, status: 'OPEN' }
                });

                if (remainingOpen === 0) {
                    await tx.dailyRecord.update({
                        where: { id: dailyRecordId },
                        data: { status: 'CLOSED' }
                    });
                }
            }

            return { closedShiftIds, touchedDailyRecordIds: Array.from(touchedDailyRecordIds) };
        });

        return NextResponse.json({
            success: true,
            cutoffDate: cutoffDate.toISOString(),
            closedCount: result.closedShiftIds.length,
            dailyRecordCount: result.touchedDailyRecordIds.length,
            closedShiftIds: result.closedShiftIds,
        });
    } catch (error) {
        console.error('[Gas Stale Shifts POST]:', error);
        return NextResponse.json({ error: 'Failed to close stale gas shifts' }, { status: 500 });
    }
}
