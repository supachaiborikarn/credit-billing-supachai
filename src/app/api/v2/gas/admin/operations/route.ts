import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
    isValidDateKey,
} from '@/lib/gas/date-utils';

function toPositivePrice(value: unknown): number | null {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Number(parsed.toFixed(2));
}

function toDateKey(value: unknown): string | null {
    const dateKey = typeof value === 'string' && value.trim()
        ? value.trim()
        : getTodayBangkok();

    return isValidDateKey(dateKey) ? dateKey : null;
}

function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getBangkokDateKey(date: Date): string {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function buildOperationsPayload(dateKey: string) {
    const startOfDay = getStartOfDayBangkokUTC(dateKey);
    const endOfDay = getEndOfDayBangkokUTC(dateKey);
    const [stations, globalPrice] = await Promise.all([
        prisma.station.findMany({
            where: { type: 'GAS' },
            select: {
                id: true,
                name: true,
                gasPrice: true,
                dailyRecords: {
                    where: {
                        date: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                    include: {
                        shifts: {
                            orderBy: [
                                { shiftNumber: 'asc' },
                                { createdAt: 'asc' },
                            ],
                            include: {
                                staff: { select: { name: true } },
                                meters: { select: { endReading: true } },
                                transactions: {
                                    where: {
                                        deletedAt: null,
                                        isVoided: false,
                                    },
                                    select: { id: true },
                                },
                                reconciliation: { select: { id: true } },
                            },
                        },
                        transactions: {
                            where: {
                                deletedAt: null,
                                isVoided: false,
                            },
                            select: {
                                id: true,
                                shiftId: true,
                            },
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
        }),
        prisma.gasSettings.findUnique({
            where: { key: 'gasPrice' },
            select: { value: true },
        }),
    ]);

    return {
        dateKey,
        globalGasPrice: toPositivePrice(globalPrice?.value) ?? 16.09,
        stations: stations.map((station) => {
            const dailyRecord = station.dailyRecords[0] ?? null;
            const shifts = dailyRecord?.shifts ?? [];
            const openShift = shifts.find((shift) => shift.status === 'OPEN') ?? null;
            const hasShift1 = shifts.some((shift) => shift.shiftNumber === 1);
            const hasShift2 = shifts.some((shift) => shift.shiftNumber === 2);
            const nextShiftNumber = openShift
                ? null
                : (!hasShift1 ? 1 : (!hasShift2 ? 2 : null));

            return {
                id: station.id,
                name: station.name,
                stationGasPrice: toNumberOrNull(station.gasPrice),
                todayGasPrice: toNumberOrNull(dailyRecord?.gasPrice),
                effectiveGasPrice: toNumberOrNull(dailyRecord?.gasPrice)
                    ?? toNumberOrNull(station.gasPrice)
                    ?? toPositivePrice(globalPrice?.value)
                    ?? 16.09,
                dailyRecord: dailyRecord ? {
                    id: dailyRecord.id,
                    dateKey: getBangkokDateKey(dailyRecord.date),
                } : null,
                openShiftId: openShift?.id ?? null,
                nextShiftNumber,
                dayComplete: !openShift && nextShiftNumber === null,
                orphanTransactions: dailyRecord?.transactions.filter((transaction) => !transaction.shiftId).length ?? 0,
                shifts: shifts.map((shift) => {
                    const transactionCount = shift.transactions.length;
                    const meterRows = shift.meters.length;
                    const endMeterCount = shift.meters.filter((meter) => meter.endReading !== null).length;
                    const canForceCloseEmpty = shift.status === 'OPEN'
                        && transactionCount === 0
                        && endMeterCount === 0
                        && !shift.reconciliation;

                    return {
                        id: shift.id,
                        shiftNumber: shift.shiftNumber,
                        status: shift.status,
                        staffName: shift.staff?.name ?? null,
                        openedAt: shift.createdAt.toISOString(),
                        closedAt: shift.closedAt?.toISOString() ?? null,
                        transactionCount,
                        meterRows,
                        endMeterCount,
                        hasReconciliation: Boolean(shift.reconciliation),
                        canForceCloseEmpty,
                    };
                }),
            };
        }),
    };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateKey = toDateKey(searchParams.get('dateKey'));
        if (!dateKey) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        return NextResponse.json(await buildOperationsPayload(dateKey));
    } catch (error) {
        console.error('[Gas Admin Operations GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch gas operations' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const action = body.action;

        if (action === 'setGasPrice') {
            const dateKey = toDateKey(body.dateKey);
            const stationId = typeof body.stationId === 'string' ? body.stationId : null;
            const gasPrice = toPositivePrice(body.gasPrice);

            if (!dateKey || !stationId || gasPrice === null) {
                return NextResponse.json({ error: 'ข้อมูลราคาหรือวันที่ไม่ถูกต้อง' }, { status: 400 });
            }

            const startOfDay = getStartOfDayBangkokUTC(dateKey);
            const endOfDay = getEndOfDayBangkokUTC(dateKey);
            const result = await prisma.$transaction(async (tx) => {
                const station = await tx.station.findFirst({
                    where: {
                        id: stationId,
                        type: 'GAS',
                    },
                    select: {
                        id: true,
                        gasPrice: true,
                    },
                });

                if (!station) {
                    return { error: 'ไม่พบปั๊มแก๊สนี้', status: 404 as const };
                }

                const existingRecord = await tx.dailyRecord.findFirst({
                    where: {
                        stationId,
                        date: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                    select: {
                        id: true,
                        gasPrice: true,
                        retailPrice: true,
                        wholesalePrice: true,
                    },
                });

                const dailyRecord = existingRecord
                    ? await tx.dailyRecord.update({
                        where: { id: existingRecord.id },
                        data: {
                            gasPrice,
                            retailPrice: gasPrice,
                            wholesalePrice: gasPrice,
                        },
                        select: {
                            id: true,
                            gasPrice: true,
                        },
                    })
                    : await tx.dailyRecord.create({
                        data: {
                            stationId,
                            date: startOfDay,
                            gasPrice,
                            retailPrice: gasPrice,
                            wholesalePrice: gasPrice,
                        },
                        select: {
                            id: true,
                            gasPrice: true,
                        },
                    });

                await tx.station.update({
                    where: { id: stationId },
                    data: { gasPrice },
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: existingRecord ? 'UPDATE' : 'CREATE',
                        model: 'DailyRecord',
                        recordId: dailyRecord.id,
                        oldData: existingRecord ? {
                            dateKey,
                            gasPrice: toNumberOrNull(existingRecord.gasPrice),
                            retailPrice: toNumberOrNull(existingRecord.retailPrice),
                            wholesalePrice: toNumberOrNull(existingRecord.wholesalePrice),
                        } : undefined,
                        newData: {
                            stationId,
                            dateKey,
                            gasPrice,
                            source: 'gas-admin-operations-price',
                            persistsAsStationDefault: true,
                        },
                    },
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: 'UPDATE',
                        model: 'Station',
                        recordId: stationId,
                        oldData: {
                            gasPrice: toNumberOrNull(station.gasPrice),
                        },
                        newData: {
                            stationId,
                            dateKey,
                            gasPrice,
                            source: 'gas-admin-operations-price',
                        },
                    },
                });

                return {
                    dailyRecordId: dailyRecord.id,
                    gasPrice: Number(dailyRecord.gasPrice),
                };
            });

            if ('error' in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }

            return NextResponse.json({
                success: true,
                message: 'อัปเดตราคาและตั้งเป็นราคาหลักแล้ว',
                ...result,
            });
        }

        if (action === 'closeEmptyShift') {
            const shiftId = typeof body.shiftId === 'string' ? body.shiftId : null;
            if (!shiftId) {
                return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
            }

            const result = await prisma.$transaction(async (tx) => {
                const shift = await tx.shift.findUnique({
                    where: { id: shiftId },
                    include: {
                        dailyRecord: {
                            select: {
                                stationId: true,
                                date: true,
                            },
                        },
                        meters: { select: { endReading: true } },
                        transactions: {
                            where: {
                                deletedAt: null,
                                isVoided: false,
                            },
                            select: { id: true },
                        },
                        reconciliation: { select: { id: true } },
                    },
                });

                if (!shift) {
                    return { error: 'ไม่พบกะนี้', status: 404 as const };
                }

                if (shift.status !== 'OPEN') {
                    return { error: 'กะนี้ไม่ได้เปิดอยู่', status: 409 as const };
                }

                const endMeterCount = shift.meters.filter((meter) => meter.endReading !== null).length;
                if (shift.transactions.length > 0 || endMeterCount > 0 || shift.reconciliation) {
                    return {
                        error: 'กะนี้มีข้อมูลขาย/มิเตอร์ปิด/กระทบยอดแล้ว ให้เข้าหน้าปิดกะเพื่อปิดตามขั้นตอน',
                        status: 409 as const,
                    };
                }

                const dateKey = getBangkokDateKey(shift.dailyRecord.date);
                const closedShift = await tx.shift.update({
                    where: { id: shiftId },
                    data: {
                        status: 'CLOSED',
                        closedAt: new Date(),
                        closedById: auth.user.id,
                        varianceNote: [
                            shift.varianceNote,
                            'admin-empty-shift-close',
                        ].filter(Boolean).join(' | '),
                    },
                    select: {
                        id: true,
                        shiftNumber: true,
                    },
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: 'UPDATE',
                        model: 'Shift',
                        recordId: shiftId,
                        oldData: {
                            status: shift.status,
                            closedAt: shift.closedAt,
                        },
                        newData: {
                            status: 'CLOSED',
                            stationId: shift.dailyRecord.stationId,
                            dateKey,
                            shiftNumber: shift.shiftNumber,
                            source: 'gas-admin-operations-empty-shift-close',
                        },
                    },
                });

                return {
                    shiftId: closedShift.id,
                    shiftNumber: closedShift.shiftNumber,
                };
            });

            if ('error' in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }

            return NextResponse.json({
                success: true,
                message: 'ปิดกะว่าง/กะค้างสำเร็จ',
                ...result,
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('[Gas Admin Operations PATCH]:', error);
        return NextResponse.json({ error: 'Failed to update gas operations' }, { status: 500 });
    }
}
