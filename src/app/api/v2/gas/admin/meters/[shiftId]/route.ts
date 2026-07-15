import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import { getShiftName, toBangkokDateKey } from '@/lib/gas';
import {
    GAS_NOZZLE_NUMBERS,
    validateGasMeterPayload,
} from '@/lib/gas/v2-workflow';

class AdminMeterError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

function getVarianceStatus(variance: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (Math.abs(variance) > 500) return 'RED';
    if (Math.abs(variance) > 100) return 'YELLOW';
    return 'GREEN';
}

function round(value: number, digits: number): number {
    return Number(value.toFixed(digits));
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { shiftId } = await params;
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                dailyRecord: {
                    include: {
                        station: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                            },
                        },
                    },
                },
                meters: { orderBy: { nozzleNumber: 'asc' } },
                reconciliation: { select: { id: true } },
            },
        });

        if (!shift || shift.dailyRecord.station.type !== 'GAS') {
            return NextResponse.json({ error: 'ไม่พบกะของปั๊มแก๊สนี้' }, { status: 404 });
        }

        const previousShift = await prisma.shift.findFirst({
            where: {
                status: { in: ['CLOSED', 'LOCKED'] },
                dailyRecord: { stationId: shift.dailyRecord.stationId },
                OR: [
                    { dailyRecord: { date: { lt: shift.dailyRecord.date } } },
                    {
                        dailyRecordId: shift.dailyRecordId,
                        shiftNumber: { lt: shift.shiftNumber },
                    },
                ],
                meters: { some: { endReading: { not: null } } },
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                dailyRecord: { select: { date: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
            },
        });

        const previousByNozzle = new Map(
            previousShift?.meters.map((meter) => [meter.nozzleNumber, meter]) ?? []
        );
        const currentByNozzle = new Map(
            shift.meters.map((meter) => [meter.nozzleNumber, meter])
        );

        return NextResponse.json({
            shift: {
                id: shift.id,
                stationId: shift.dailyRecord.station.id,
                stationName: shift.dailyRecord.station.name,
                dateKey: toBangkokDateKey(shift.dailyRecord.date),
                shiftNumber: shift.shiftNumber,
                shiftName: getShiftName(shift.shiftNumber),
                status: shift.status,
                hasReconciliation: Boolean(shift.reconciliation),
            },
            previousShift: previousShift ? {
                id: previousShift.id,
                dateKey: toBangkokDateKey(previousShift.dailyRecord.date),
                shiftNumber: previousShift.shiftNumber,
                shiftName: getShiftName(previousShift.shiftNumber),
            } : null,
            meters: GAS_NOZZLE_NUMBERS.map((nozzleNumber) => {
                const meter = currentByNozzle.get(nozzleNumber);
                const previousMeter = previousByNozzle.get(nozzleNumber);

                return {
                    id: meter?.id ?? null,
                    nozzleNumber,
                    startReading: meter ? Number(meter.startReading) : null,
                    endReading: meter?.endReading === null || meter?.endReading === undefined
                        ? null
                        : Number(meter.endReading),
                    soldQty: meter?.soldQty === null || meter?.soldQty === undefined
                        ? null
                        : Number(meter.soldQty),
                    previousEndReading: previousMeter?.endReading === null
                        || previousMeter?.endReading === undefined
                        ? null
                        : Number(previousMeter.endReading),
                };
            }),
        });
    } catch (error) {
        console.error('[Gas Admin Meters GET]:', error);
        return NextResponse.json({ error: 'โหลดข้อมูลมิเตอร์ไม่สำเร็จ' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { shiftId } = await params;
        const body = await request.json();
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

        if (reason.length < 3 || reason.length > 500) {
            return NextResponse.json({
                error: 'กรุณาระบุเหตุผลในการแก้ไข 3-500 ตัวอักษร',
            }, { status: 400 });
        }

        const validation = validateGasMeterPayload(body.readings);
        if (!validation.ok) {
            return NextResponse.json({
                error: validation.errors[0] || 'ข้อมูลมิเตอร์ไม่ถูกต้อง',
                errors: validation.errors,
            }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const shift = await tx.shift.findUnique({
                where: { id: shiftId },
                include: {
                    dailyRecord: {
                        include: {
                            station: {
                                select: {
                                    id: true,
                                    name: true,
                                    type: true,
                                    gasPrice: true,
                                },
                            },
                        },
                    },
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                    reconciliation: true,
                },
            });

            if (!shift || shift.dailyRecord.station.type !== 'GAS') {
                throw new AdminMeterError('ไม่พบกะของปั๊มแก๊สนี้', 404);
            }

            const currentByNozzle = new Map(
                shift.meters.map((meter) => [meter.nozzleNumber, meter])
            );
            const requestedByNozzle = new Map(
                validation.value.map((reading) => [reading.nozzleNumber, reading.reading])
            );

            const missingNozzles = GAS_NOZZLE_NUMBERS.filter(
                (nozzleNumber) => !currentByNozzle.has(nozzleNumber)
            );
            if (missingNozzles.length > 0) {
                throw new AdminMeterError(
                    `กะนี้ไม่มีข้อมูลหัวจ่าย ${missingNozzles.join(', ')} กรุณาตรวจสอบข้อมูลกะก่อน`,
                    409
                );
            }

            for (const nozzleNumber of GAS_NOZZLE_NUMBERS) {
                const meter = currentByNozzle.get(nozzleNumber)!;
                const requestedStart = requestedByNozzle.get(nozzleNumber)!;
                if (meter.endReading !== null && requestedStart > Number(meter.endReading)) {
                    throw new AdminMeterError(
                        `หัวจ่าย ${nozzleNumber}: มิเตอร์เปิดต้องไม่มากกว่ามิเตอร์ปิด ${Number(meter.endReading).toLocaleString()}`,
                        400
                    );
                }
            }

            const oldMeters = GAS_NOZZLE_NUMBERS.map((nozzleNumber) => {
                const meter = currentByNozzle.get(nozzleNumber)!;
                return {
                    nozzleNumber,
                    startReading: Number(meter.startReading),
                    endReading: meter.endReading === null ? null : Number(meter.endReading),
                    soldQty: meter.soldQty === null ? null : Number(meter.soldQty),
                };
            });
            const changedNozzles = oldMeters.filter(
                (meter) => meter.startReading !== requestedByNozzle.get(meter.nozzleNumber)
            );

            if (changedNozzles.length === 0) {
                return {
                    changedCount: 0,
                    meters: oldMeters,
                    reconciliation: shift.reconciliation ? {
                        expectedFuelAmount: Number(shift.reconciliation.expectedFuelAmount),
                        totalExpected: Number(shift.reconciliation.totalExpected),
                        variance: Number(shift.reconciliation.variance),
                        varianceStatus: shift.reconciliation.varianceStatus,
                    } : null,
                };
            }

            const newMeters = [];
            for (const nozzleNumber of GAS_NOZZLE_NUMBERS) {
                const meter = currentByNozzle.get(nozzleNumber)!;
                const startReading = requestedByNozzle.get(nozzleNumber)!;
                const endReading = meter.endReading === null ? null : Number(meter.endReading);
                const soldQty = endReading === null
                    ? null
                    : round(Math.max(endReading - startReading, 0), 4);

                await tx.meterReading.update({
                    where: { id: meter.id },
                    data: { startReading, soldQty },
                });

                newMeters.push({
                    nozzleNumber,
                    startReading,
                    endReading,
                    soldQty,
                });
            }

            let reconciliation = shift.reconciliation ? {
                expectedFuelAmount: Number(shift.reconciliation.expectedFuelAmount),
                totalExpected: Number(shift.reconciliation.totalExpected),
                variance: Number(shift.reconciliation.variance),
                varianceStatus: shift.reconciliation.varianceStatus,
            } : null;

            if (shift.reconciliation) {
                if (newMeters.some((meter) => meter.endReading === null)) {
                    throw new AdminMeterError(
                        'กะนี้มีกระทบยอดแล้ว แต่ข้อมูลมิเตอร์ปิดยังไม่ครบ กรุณาตรวจสอบกะก่อน',
                        409
                    );
                }

                const gasPrice = Number(
                    shift.dailyRecord.gasPrice ?? shift.dailyRecord.station.gasPrice ?? 0
                );
                if (!Number.isFinite(gasPrice) || gasPrice <= 0) {
                    throw new AdminMeterError('ไม่พบราคาขายของกะนี้ จึงคำนวณยอดใหม่ไม่ได้', 409);
                }

                const totalLiters = round(
                    newMeters.reduce((sum, meter) => sum + (meter.soldQty ?? 0), 0),
                    4
                );
                const expectedFuelAmount = round(totalLiters * gasPrice, 2);
                const expectedOtherAmount = Number(shift.reconciliation.expectedOtherAmount);
                const totalExpected = round(expectedFuelAmount + expectedOtherAmount, 2);
                const totalReceived = Number(shift.reconciliation.totalReceived);
                const variance = round(totalReceived - totalExpected, 2);
                const varianceStatus = getVarianceStatus(variance);

                await tx.shiftReconciliation.update({
                    where: { shiftId: shift.id },
                    data: {
                        expectedFuelAmount,
                        totalExpected,
                        variance,
                        varianceStatus,
                    },
                });

                reconciliation = {
                    expectedFuelAmount,
                    totalExpected,
                    variance,
                    varianceStatus,
                };
            }

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'UPDATE_OPENING_METERS',
                    model: 'Shift',
                    recordId: shift.id,
                    oldData: {
                        stationId: shift.dailyRecord.station.id,
                        dateKey: toBangkokDateKey(shift.dailyRecord.date),
                        shiftNumber: shift.shiftNumber,
                        meters: oldMeters,
                        reconciliation: shift.reconciliation ? {
                            expectedFuelAmount: Number(shift.reconciliation.expectedFuelAmount),
                            totalExpected: Number(shift.reconciliation.totalExpected),
                            variance: Number(shift.reconciliation.variance),
                            varianceStatus: shift.reconciliation.varianceStatus,
                        } : null,
                    },
                    newData: {
                        stationId: shift.dailyRecord.station.id,
                        dateKey: toBangkokDateKey(shift.dailyRecord.date),
                        shiftNumber: shift.shiftNumber,
                        meters: newMeters,
                        reconciliation,
                        reason,
                        source: 'gas-admin-meter-edit',
                    },
                },
            });

            return {
                changedCount: changedNozzles.length,
                meters: newMeters,
                reconciliation,
            };
        }, { timeout: 30_000 });

        return NextResponse.json({
            success: true,
            message: result.changedCount > 0
                ? `แก้เลขมิเตอร์เปิด ${result.changedCount} หัวจ่ายแล้ว`
                : 'เลขมิเตอร์ไม่มีการเปลี่ยนแปลง',
            ...result,
        });
    } catch (error) {
        if (error instanceof AdminMeterError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error('[Gas Admin Meters PUT]:', error);
        return NextResponse.json({ error: 'บันทึกมิเตอร์ไม่สำเร็จ' }, { status: 500 });
    }
}
