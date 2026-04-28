import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
    isValidDateKey,
} from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

function normalizeGasPrice(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.round(parsed * 100) / 100;
}

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * PUT /api/v2/gas/[stationId]/price
 * Update the daily gas price for staff workflows.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station, user } = auth;

        const body = await request.json();
        const gasPrice = normalizeGasPrice(body.gasPrice);
        if (gasPrice === null) {
            return NextResponse.json({ error: 'ราคาขายต้องเป็นตัวเลขมากกว่า 0' }, { status: 400 });
        }

        const dateKey = typeof body.dateKey === 'string' && body.dateKey.trim()
            ? body.dateKey.trim()
            : getTodayBangkok();

        if (!isValidDateKey(dateKey)) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const startOfDay = getStartOfDayBangkokUTC(dateKey);
        const endOfDay = getEndOfDayBangkokUTC(dateKey);

        const result = await prisma.$transaction(async (tx) => {
            const existingRecord = await tx.dailyRecord.findFirst({
                where: {
                    stationId: station.dbId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
                orderBy: { date: 'asc' },
                select: {
                    id: true,
                    date: true,
                    gasPrice: true,
                    retailPrice: true,
                    wholesalePrice: true,
                },
            });

            const existingStation = await tx.station.findUnique({
                where: { id: station.dbId },
                select: {
                    id: true,
                    gasPrice: true,
                },
            });

            const savedRecord = existingRecord
                ? await tx.dailyRecord.update({
                    where: { id: existingRecord.id },
                    data: {
                        gasPrice,
                        retailPrice: gasPrice,
                        wholesalePrice: gasPrice,
                    },
                    select: {
                        id: true,
                        date: true,
                        gasPrice: true,
                    },
                })
                : await tx.dailyRecord.create({
                    data: {
                        stationId: station.dbId,
                        date: startOfDay,
                        gasPrice,
                        retailPrice: gasPrice,
                        wholesalePrice: gasPrice,
                    },
                    select: {
                        id: true,
                        date: true,
                        gasPrice: true,
                    },
                });

            await tx.station.update({
                where: { id: station.dbId },
                data: { gasPrice },
            });

            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: existingRecord ? 'UPDATE' : 'CREATE',
                    model: 'DailyRecord',
                    recordId: savedRecord.id,
                    oldData: existingRecord
                        ? {
                            dateKey,
                            gasPrice: numberOrNull(existingRecord.gasPrice),
                            retailPrice: numberOrNull(existingRecord.retailPrice),
                            wholesalePrice: numberOrNull(existingRecord.wholesalePrice),
                        }
                        : undefined,
                    newData: {
                        dateKey,
                        stationId: station.dbId,
                        gasPrice,
                        source: 'gas-staff-price-update',
                        persistsAsStationDefault: true,
                    },
                },
            });

            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'UPDATE',
                    model: 'Station',
                    recordId: station.dbId,
                    oldData: {
                        gasPrice: numberOrNull(existingStation?.gasPrice),
                    },
                    newData: {
                        gasPrice,
                        dateKey,
                        source: 'gas-staff-price-update',
                    },
                },
            });

            return {
                dailyRecord: savedRecord,
                previousStationGasPrice: numberOrNull(existingStation?.gasPrice),
            };
        });

        return NextResponse.json({
            success: true,
            gasPrice: Number(result.dailyRecord.gasPrice),
            stationGasPrice: gasPrice,
            previousStationGasPrice: result.previousStationGasPrice,
            dailyRecordId: result.dailyRecord.id,
            dateKey,
            message: 'อัปเดตราคาขายแก๊สและตั้งเป็นราคาหลักแล้ว',
        });
    } catch (error) {
        console.error('[Gas Price Update]:', error);
        return NextResponse.json({ error: 'Failed to update gas price' }, { status: 500 });
    }
}
