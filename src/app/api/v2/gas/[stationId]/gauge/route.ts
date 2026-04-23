import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasStationAccess, shiftBelongsToStation } from '@/lib/gas/api-guards';
import {
    getGasStartBaselineLock,
    validateGasGaugePayload,
} from '@/lib/gas/v2-workflow';

async function getShiftForStation(shiftId: string, stationDbId: string) {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            dailyRecord: { select: { stationId: true } },
            meters: {
                select: {
                    endReading: true,
                },
            },
            reconciliation: {
                select: {
                    id: true,
                },
            },
        }
    });

    if (!shift) return null;
    if (!shiftBelongsToStation(shift, { dbId: stationDbId })) return null;
    return shift;
}

/**
 * GET /api/v2/gas/[stationId]/gauge?shiftId=...
 * Get gauge readings for a shift.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId');

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId required' }, { status: 400 });
        }

        const shift = await getShiftForStation(shiftId, auth.station.dbId);
        if (!shift) {
            return NextResponse.json({ error: 'Shift not found for this station' }, { status: 404 });
        }

        const gauges = await prisma.gaugeReading.findMany({
            where: {
                stationId: auth.station.dbId,
                dailyRecordId: shift.dailyRecordId,
                shiftNumber: shift.shiftNumber,
            },
            orderBy: [
                { tankNumber: 'asc' },
                { createdAt: 'asc' },
            ]
        });

        const format = (notes: string) => gauges
            .filter((g) => g.notes === notes)
            .map((g) => ({
                tankNumber: g.tankNumber,
                percentage: Number(g.percentage),
                photoUrl: g.photoUrl,
                recordedAt: g.createdAt,
            }));

        return NextResponse.json({
            readings: {
                start: format('start'),
                end: format('end'),
            }
        });
    } catch (error) {
        console.error('[Gauge GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}

/**
 * POST /api/v2/gas/[stationId]/gauge
 * Save start/end gauge readings for a shift.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { shiftId, type, readings } = body;

        if (!shiftId || !['start', 'end'].includes(type)) {
            return NextResponse.json({ error: 'shiftId and type are required' }, { status: 400 });
        }

        const validation = validateGasGaugePayload(readings);
        if (!validation.ok) {
            return NextResponse.json({
                error: validation.errors[0] || 'Invalid gauge readings',
                errors: validation.errors,
            }, { status: 400 });
        }

        const shift = await getShiftForStation(shiftId, auth.station.dbId);
        if (!shift) {
            return NextResponse.json({ error: 'Shift not found for this station' }, { status: 404 });
        }
        if (shift.status !== 'OPEN') {
            return NextResponse.json({ error: 'Shift is not open' }, { status: 409 });
        }

        if (type === 'start') {
            const [transactionCount, endGaugeCount] = await Promise.all([
                prisma.transaction.count({
                    where: {
                        shiftId,
                        deletedAt: null,
                        isVoided: false,
                    },
                }),
                prisma.gaugeReading.count({
                    where: {
                        stationId: auth.station.dbId,
                        dailyRecordId: shift.dailyRecordId,
                        shiftNumber: shift.shiftNumber,
                        notes: 'end',
                    },
                }),
            ]);

            const startBaselineLock = getGasStartBaselineLock({
                shiftStatus: shift.status,
                transactionCount,
                hasEndMeters: shift.meters.some((meter) => meter.endReading !== null),
                hasEndGauges: endGaugeCount > 0,
                hasReconciliation: Boolean(shift.reconciliation),
            });

            if (startBaselineLock.locked) {
                return NextResponse.json({
                    error: startBaselineLock.reason || 'Start gauge readings are locked',
                }, { status: 409 });
            }
        }

        const saved = await Promise.all(
            validation.value.map(async (reading) => {
                const existing = await prisma.gaugeReading.findFirst({
                    where: {
                        stationId: auth.station.dbId,
                        dailyRecordId: shift.dailyRecordId,
                        shiftNumber: shift.shiftNumber,
                        tankNumber: reading.tankNumber,
                        notes: type,
                    },
                    orderBy: { createdAt: 'desc' }
                });

                const data = {
                    stationId: auth.station.dbId,
                    dailyRecordId: shift.dailyRecordId,
                    date: new Date(),
                    tankNumber: reading.tankNumber,
                    percentage: reading.percentage,
                    photoUrl: reading.photoUrl || null,
                    recordedById: auth.user.id,
                    shiftNumber: shift.shiftNumber,
                    notes: type,
                };

                if (existing) {
                    return prisma.gaugeReading.update({
                        where: { id: existing.id },
                        data
                    });
                }

                return prisma.gaugeReading.create({ data });
            })
        );

        return NextResponse.json({
            success: true,
            count: saved.length,
            type,
        });
    } catch (error) {
        console.error('[Gauge POST]:', error);
        return NextResponse.json({ error: 'Failed to save gauge readings' }, { status: 500 });
    }
}
