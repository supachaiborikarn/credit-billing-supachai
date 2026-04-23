import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasStationAccess, shiftBelongsToStation } from '@/lib/gas/api-guards';
import {
    getGasStartBaselineLock,
    validateGasMeterPayload,
} from '@/lib/gas/v2-workflow';

/**
 * POST /api/v2/gas/[stationId]/meters
 * Save meter readings for a shift
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

        if (!shiftId || !type || !readings || !Array.isArray(readings)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate type
        if (type !== 'start' && type !== 'end') {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const validation = validateGasMeterPayload(readings);
        if (!validation.ok) {
            return NextResponse.json({
                error: validation.errors[0] || 'Invalid meter readings',
                errors: validation.errors,
            }, { status: 400 });
        }

        // Get the shift and its daily record
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                dailyRecord: true,
                meters: true,
                reconciliation: true,
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        if (!shiftBelongsToStation(shift, auth.station)) {
            return NextResponse.json({ error: 'Shift does not belong to this station' }, { status: 403 });
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
                    error: startBaselineLock.reason || 'Start readings are locked',
                }, { status: 409 });
            }
        }

        if (type === 'end') {
            const missingStarts = validation.value
                .filter((reading) => {
                    const existingMeter = shift.meters.find((meter) => meter.nozzleNumber === reading.nozzleNumber);
                    return !existingMeter || existingMeter.startReading === null;
                })
                .map((reading) => reading.nozzleNumber);

            if (missingStarts.length > 0) {
                return NextResponse.json({
                    error: `ยังไม่มีมิเตอร์เริ่มกะสำหรับหัวจ่าย: ${missingStarts.join(', ')}`,
                }, { status: 400 });
            }
        }

        // Process each reading
        const results = await Promise.all(
            validation.value.map(async (reading) => {
                const nozzleNumber = reading.nozzleNumber;
                const value = reading.reading;
                const photoUrl = reading.photoUrl || null;

                // Check if meter reading exists for this shift and nozzle
                const existingMeter = shift.meters.find(m => m.nozzleNumber === nozzleNumber);

                if (existingMeter) {
                    // Update existing meter reading
                    if (type === 'start') {
                        return prisma.meterReading.update({
                            where: { id: existingMeter.id },
                            data: {
                                startReading: value,
                                startPhoto: photoUrl,
                                capturedById: auth.user.id,
                            }
                        });
                    } else {
                        // End reading - also calculate sold quantity
                        const startReading = Number(existingMeter.startReading || 0);
                        const soldQty = value - startReading;

                        return prisma.meterReading.update({
                            where: { id: existingMeter.id },
                            data: {
                                endReading: value,
                                endPhoto: photoUrl,
                                soldQty: soldQty > 0 ? soldQty : 0,
                                capturedById: auth.user.id,
                            }
                        });
                    }
                } else {
                    // Create new meter reading
                    const data: {
                        dailyRecordId: string;
                        shiftId: string;
                        nozzleNumber: number;
                        startReading?: number;
                        endReading?: number;
                        soldQty?: number;
                        startPhoto?: string | null;
                        endPhoto?: string | null;
                        capturedById?: string | null;
                    } = {
                        dailyRecordId: shift.dailyRecordId,
                        shiftId: shiftId,
                        nozzleNumber: nozzleNumber,
                        capturedById: auth.user.id
                    };

                    if (type === 'start') {
                        data.startReading = value;
                        data.startPhoto = photoUrl;
                    } else {
                        data.endReading = value;
                        data.endPhoto = photoUrl;
                        data.soldQty = 0;
                    }

                    return prisma.meterReading.create({ data });
                }
            })
        );

        // Log the action
        // Meter readings saved successfully

        return NextResponse.json({
            success: true,
            count: results.length,
            type
        });
    } catch (error) {
        console.error('[Meters POST]:', error);
        return NextResponse.json({ error: 'Failed to save meter readings' }, { status: 500 });
    }
}

/**
 * GET /api/v2/gas/[stationId]/meters
 * Get meter readings for a shift
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

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: { dailyRecord: { select: { stationId: true } } }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        if (!shiftBelongsToStation(shift, auth.station)) {
            return NextResponse.json({ error: 'Shift does not belong to this station' }, { status: 403 });
        }

        const meters = await prisma.meterReading.findMany({
            where: { shiftId },
            orderBy: { nozzleNumber: 'asc' }
        });

        return NextResponse.json({ meters });
    } catch (error) {
        console.error('[Meters GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch meter readings' }, { status: 500 });
    }
}
