import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bangkokDateToUTC } from '@/lib/gas';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';
import { requireStationAccessApi } from '@/lib/api-auth';
import {
    getDefaultGasPriceForStation,
    validateGasGaugePayload,
    validateGasMeterPayload,
} from '@/lib/gas/v2-workflow';

/**
 * POST /api/v2/gas/[stationId]/shift/open
 * Open a new shift with mandatory meter and gauge readings (GAS stations only)
 */
export async function POST(
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
        const auth = await requireStationAccessApi(station.dbId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { dateKey, shiftNumber, meters, gauges, gasPrice } = body;
        const userId = auth.user.id;

        // Validate inputs
        if (!dateKey || !Number.isInteger(shiftNumber) || shiftNumber < 1 || shiftNumber > 2) {
            return NextResponse.json({ error: 'dateKey and shiftNumber are required' }, { status: 400 });
        }

        const hasSubmittedGasPrice = gasPrice !== undefined && gasPrice !== null && String(gasPrice).trim() !== '';
        const submittedGasPrice = hasSubmittedGasPrice ? Number(gasPrice) : null;
        if (hasSubmittedGasPrice && (submittedGasPrice === null || !Number.isFinite(submittedGasPrice) || submittedGasPrice <= 0)) {
            return NextResponse.json({ error: 'ราคาขายต้องเป็นตัวเลขมากกว่า 0' }, { status: 400 });
        }

        const meterValidation = validateGasMeterPayload(meters);
        if (!meterValidation.ok) {
            return NextResponse.json({
                error: meterValidation.errors[0] || 'Invalid meter readings',
                errors: meterValidation.errors,
            }, { status: 400 });
        }

        const gaugeValidation = validateGasGaugePayload(gauges);
        if (!gaugeValidation.ok) {
            return NextResponse.json({
                error: gaugeValidation.errors[0] || 'Invalid gauge readings',
                errors: gaugeValidation.errors,
            }, { status: 400 });
        }

        const dateUTC = bangkokDateToUTC(dateKey);
        return await prisma.$transaction(async (tx) => {
            const existingOpenShift = await tx.shift.findFirst({
                where: {
                    status: 'OPEN',
                    dailyRecord: {
                        stationId: station.dbId,
                        date: dateUTC,
                    },
                },
            });

            if (existingOpenShift) {
                return NextResponse.json({ error: 'มีกะที่เปิดอยู่แล้ว' }, { status: 400 });
            }

            let dailyRecord = await tx.dailyRecord.findFirst({
                where: {
                    stationId: station.dbId,
                    date: dateUTC,
                },
            });

            const dailyGasPrice = submittedGasPrice ?? await getDefaultGasPriceForStation(tx, station.dbId);

            if (!dailyRecord) {
                dailyRecord = await tx.dailyRecord.create({
                    data: {
                        stationId: station.dbId,
                        date: dateUTC,
                        gasPrice: dailyGasPrice,
                        retailPrice: dailyGasPrice,
                        wholesalePrice: dailyGasPrice,
                    },
                });
            } else if (submittedGasPrice !== null || !dailyRecord.gasPrice || Number(dailyRecord.gasPrice) <= 0) {
                dailyRecord = await tx.dailyRecord.update({
                    where: { id: dailyRecord.id },
                    data: {
                        gasPrice: dailyGasPrice,
                        retailPrice: dailyGasPrice,
                        wholesalePrice: dailyGasPrice,
                    },
                });
            }

            const shift = await tx.shift.create({
                data: {
                    dailyRecordId: dailyRecord.id,
                    shiftNumber,
                    staffId: userId,
                    status: 'OPEN',
                },
            });

            await Promise.all(
                meterValidation.value.map((meter) => tx.meterReading.create({
                    data: {
                        shiftId: shift.id,
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: meter.nozzleNumber,
                        startReading: meter.reading,
                        startPhoto: meter.photoUrl || null,
                        capturedById: userId,
                    },
                }))
            );

            await Promise.all(
                gaugeValidation.value.map((gauge) => tx.gaugeReading.create({
                    data: {
                        stationId: station.dbId,
                        dailyRecordId: dailyRecord.id,
                        date: dailyRecord.date,
                        tankNumber: gauge.tankNumber,
                        percentage: gauge.percentage,
                        photoUrl: gauge.photoUrl || null,
                        recordedById: userId,
                        shiftNumber,
                        notes: 'start',
                    },
                }))
            );

            return NextResponse.json({
                success: true,
                shiftId: shift.id,
                gasPrice: Number(dailyRecord.gasPrice || dailyGasPrice),
                message: 'เปิดกะสำเร็จ',
            });
        });
    } catch (error) {
        console.error('[Shift Open]:', error);
        return NextResponse.json({ error: 'Failed to open shift' }, { status: 500 });
    }
}
