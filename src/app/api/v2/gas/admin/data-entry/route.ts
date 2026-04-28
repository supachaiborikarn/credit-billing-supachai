import { NextRequest, NextResponse } from 'next/server';
import type { PaymentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { STATIONS, DEFAULT_GAS_PRICE } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    isValidDateKey,
} from '@/lib/gas';
import {
    buildGasVarianceNote,
    parseGasVarianceNote,
} from '@/lib/gas/admin-analytics';

type AdminSalesInput = {
    cash?: unknown;
    credit?: unknown;
    card?: unknown;
    transfer?: unknown;
    nonGasSales?: unknown;
    expenses?: unknown;
};

type AdminMeterInput = {
    nozzle?: unknown;
    start?: unknown;
    end?: unknown;
};

type AdminGaugeInput = {
    tank?: unknown;
    start?: unknown;
    end?: unknown;
    percentage?: unknown;
};

type ShiftEntryStatus = 'OPEN' | 'CLOSED';

function toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNonNegativeAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return Number(parsed.toFixed(2));
}

function toPositivePrice(value: unknown): number | null {
    const parsed = toOptionalNumber(value);
    if (parsed === null || parsed <= 0) {
        return null;
    }

    return Number(parsed.toFixed(2));
}

function getRequestedShiftNumber(value: string | null): number {
    const parsed = Number(value || 1);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 2 ? parsed : 1;
}

function normalizeShiftStatus(value: unknown): ShiftEntryStatus {
    return value === 'OPEN' ? 'OPEN' : 'CLOSED';
}

function getVarianceStatus(variance: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (Math.abs(variance) > 500) return 'RED';
    if (Math.abs(variance) > 100) return 'YELLOW';
    return 'GREEN';
}

function normalizeMeters(value: unknown): Array<{ nozzle: number; start: number | null; end: number | null }> {
    const inputRows = Array.isArray(value) ? value as AdminMeterInput[] : [];

    return [1, 2, 3, 4].map((nozzle) => {
        const row = inputRows.find((item) => Number(item.nozzle) === nozzle);
        return {
            nozzle,
            start: toOptionalNumber(row?.start),
            end: toOptionalNumber(row?.end),
        };
    });
}

function normalizeGauges(value: unknown): Array<{ tank: number; start: number | null; end: number | null }> {
    const inputRows = Array.isArray(value) ? value as AdminGaugeInput[] : [];

    return [1, 2, 3].map((tank) => {
        const row = inputRows.find((item) => Number(item.tank) === tank);
        return {
            tank,
            start: toOptionalNumber(row?.start ?? row?.percentage),
            end: toOptionalNumber(row?.end),
        };
    });
}

function validateEntryRows(
    status: ShiftEntryStatus,
    meters: Array<{ nozzle: number; start: number | null; end: number | null }>,
    gauges: Array<{ tank: number; start: number | null; end: number | null }>
): string[] {
    const errors: string[] = [];
    const missingStartMeters = meters.filter((meter) => meter.start === null).map((meter) => meter.nozzle);
    if (missingStartMeters.length > 0) {
        errors.push(`ต้องกรอกมิเตอร์เปิดกะให้ครบทุกหัวจ่าย (ขาดหัว ${missingStartMeters.join(', ')})`);
    }

    const invalidMeterRanges = meters.filter((meter) =>
        meter.start !== null && meter.end !== null && meter.end < meter.start
    ).map((meter) => meter.nozzle);
    if (invalidMeterRanges.length > 0) {
        errors.push(`มิเตอร์ปิดกะต้องมากกว่าหรือเท่ากับมิเตอร์เปิด (หัว ${invalidMeterRanges.join(', ')})`);
    }

    const missingStartGauges = gauges.filter((gauge) => gauge.start === null).map((gauge) => gauge.tank);
    if (missingStartGauges.length > 0) {
        errors.push(`ต้องกรอกเกจเปิดกะให้ครบทุกถัง (ขาดถัง ${missingStartGauges.join(', ')})`);
    }

    const invalidGauges = gauges.filter((gauge) =>
        [gauge.start, gauge.end].some((percentage) =>
            percentage !== null && (percentage < 0 || percentage > 100)
        )
    ).map((gauge) => gauge.tank);
    if (invalidGauges.length > 0) {
        errors.push(`เปอร์เซ็นต์เกจต้องอยู่ระหว่าง 0-100 (ถัง ${invalidGauges.join(', ')})`);
    }

    if (status === 'CLOSED') {
        const missingEndMeters = meters.filter((meter) => meter.end === null).map((meter) => meter.nozzle);
        if (missingEndMeters.length > 0) {
            errors.push(`ถ้าบันทึกเป็นกะปิด ต้องกรอกมิเตอร์ปิดกะให้ครบ (ขาดหัว ${missingEndMeters.join(', ')})`);
        }

        const missingEndGauges = gauges.filter((gauge) => gauge.end === null).map((gauge) => gauge.tank);
        if (missingEndGauges.length > 0) {
            errors.push(`ถ้าบันทึกเป็นกะปิด ต้องกรอกเกจปิดกะให้ครบ (ขาดถัง ${missingEndGauges.join(', ')})`);
        }
    }

    return errors;
}

function serializeDecimal(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

// GET: Fetch existing shift data for a specific date/station/shift.
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const dateKey = searchParams.get('date');
        const shiftNumber = getRequestedShiftNumber(searchParams.get('shiftNumber'));

        if (!stationId || !dateKey || !isValidDateKey(dateKey)) {
            return NextResponse.json({ error: 'ข้อมูลปั๊มหรือวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const stationConfig = STATIONS.find((station) => station.id === stationId && station.type === 'GAS');
        if (!stationConfig) {
            return NextResponse.json({ error: 'Invalid gas station' }, { status: 400 });
        }

        const startOfDay = getStartOfDayBangkokUTC(dateKey);
        const endOfDay = getEndOfDayBangkokUTC(dateKey);
        const [station, dailyRecord] = await Promise.all([
            prisma.station.findUnique({
                where: { id: stationId },
                select: { gasPrice: true },
            }),
            prisma.dailyRecord.findFirst({
                where: {
                    stationId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
                orderBy: { date: 'asc' },
                include: {
                    shifts: {
                        where: { shiftNumber },
                        include: {
                            meters: true,
                            staff: { select: { name: true } },
                            reconciliation: true,
                        },
                    },
                    gaugeReadings: {
                        where: { shiftNumber },
                    },
                },
            }),
        ]);

        const gasPrice = serializeDecimal(dailyRecord?.gasPrice)
            ?? serializeDecimal(station?.gasPrice)
            ?? DEFAULT_GAS_PRICE;

        if (!dailyRecord || dailyRecord.shifts.length === 0) {
            return NextResponse.json({
                exists: false,
                status: 'CLOSED',
                gasPrice,
                meters: [1, 2, 3, 4].map((nozzle) => ({ nozzle, start: null, end: null })),
                gauges: [1, 2, 3].map((tank) => ({ tank, start: null, end: null })),
                sales: { cash: 0, credit: 0, card: 0, transfer: 0, nonGasSales: 0, expenses: 0 },
                varianceNote: '',
            });
        }

        const shift = dailyRecord.shifts[0];
        const parsedNote = parseGasVarianceNote(shift.varianceNote);
        const meters = [1, 2, 3, 4].map((nozzle) => {
            const meter = shift.meters.find((item) => item.nozzleNumber === nozzle);
            return {
                nozzle,
                start: meter?.startReading !== null && meter?.startReading !== undefined
                    ? Number(meter.startReading)
                    : null,
                end: meter?.endReading !== null && meter?.endReading !== undefined
                    ? Number(meter.endReading)
                    : null,
            };
        });

        const gauges = [1, 2, 3].map((tank) => {
            const startGauge = dailyRecord.gaugeReadings.find((item) =>
                item.tankNumber === tank && item.notes !== 'end'
            );
            const endGauge = dailyRecord.gaugeReadings.find((item) =>
                item.tankNumber === tank && item.notes === 'end'
            );

            return {
                tank,
                start: startGauge?.percentage !== null && startGauge?.percentage !== undefined
                    ? Number(startGauge.percentage)
                    : null,
                end: endGauge?.percentage !== null && endGauge?.percentage !== undefined
                    ? Number(endGauge.percentage)
                    : null,
            };
        });

        const transactions = await prisma.transaction.groupBy({
            by: ['paymentType'],
            where: {
                stationId,
                dailyRecordId: dailyRecord.id,
                shiftId: shift.id,
                deletedAt: null,
                isVoided: false,
            },
            _sum: { amount: true },
        });

        const sales = {
            cash: 0,
            credit: 0,
            card: 0,
            transfer: 0,
            nonGasSales: parsedNote.nonGasSalesAmount,
            expenses: parsedNote.otherExpensesAmount,
        };

        transactions.forEach((transaction) => {
            const amount = Number(transaction._sum.amount) || 0;
            if (transaction.paymentType === 'CASH') sales.cash = amount;
            else if (transaction.paymentType === 'CREDIT') sales.credit = amount;
            else if (transaction.paymentType === 'CREDIT_CARD') sales.card = amount;
            else if (transaction.paymentType === 'TRANSFER') sales.transfer = amount;
        });

        return NextResponse.json({
            exists: true,
            shiftId: shift.id,
            status: shift.status,
            staffName: shift.staff?.name ?? null,
            gasPrice,
            meters,
            gauges,
            sales,
            varianceNote: parsedNote.cleanNote ?? '',
            reconciliation: shift.reconciliation ? {
                cashReceived: Number(shift.reconciliation.cashReceived),
                creditReceived: Number(shift.reconciliation.creditReceived),
                transferReceived: Number(shift.reconciliation.transferReceived),
                totalExpected: Number(shift.reconciliation.totalExpected),
                totalReceived: Number(shift.reconciliation.totalReceived),
                variance: Number(shift.reconciliation.variance),
                varianceStatus: shift.reconciliation.varianceStatus,
            } : null,
        });
    } catch (error) {
        console.error('Error fetching data entry:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST: Create/update a gas shift directly from admin data entry.
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const stationId = typeof body.stationId === 'string' ? body.stationId : null;
        const dateKey = typeof body.date === 'string' ? body.date : null;
        const shiftNumber = Number(body.shiftNumber);
        const status = normalizeShiftStatus(body.status);

        if (!stationId || !dateKey || !isValidDateKey(dateKey) || !Number.isInteger(shiftNumber) || shiftNumber < 1 || shiftNumber > 2) {
            return NextResponse.json({ error: 'ข้อมูลปั๊ม วันที่ หรือกะไม่ถูกต้อง' }, { status: 400 });
        }

        const stationConfig = STATIONS.find((station) => station.id === stationId && station.type === 'GAS');
        if (!stationConfig) {
            return NextResponse.json({ error: 'Invalid gas station' }, { status: 400 });
        }

        const gasPriceInput = toPositivePrice(body.gasPrice);
        if (body.gasPrice !== undefined && body.gasPrice !== null && body.gasPrice !== '' && gasPriceInput === null) {
            return NextResponse.json({ error: 'ราคาขายต้องเป็นตัวเลขมากกว่า 0' }, { status: 400 });
        }

        const meters = normalizeMeters(body.meters);
        const gauges = normalizeGauges(body.gauges);
        const rowErrors = validateEntryRows(status, meters, gauges);
        if (rowErrors.length > 0) {
            return NextResponse.json({ error: rowErrors[0], errors: rowErrors }, { status: 400 });
        }

        const salesInput = (body.sales || {}) as AdminSalesInput;
        const cashAmount = toNonNegativeAmount(salesInput.cash);
        const creditAmount = toNonNegativeAmount(salesInput.credit);
        const cardAmount = toNonNegativeAmount(salesInput.card);
        const transferAmount = toNonNegativeAmount(salesInput.transfer);
        const nonGasSalesAmount = toNonNegativeAmount(salesInput.nonGasSales);
        const otherExpensesAmount = toNonNegativeAmount(salesInput.expenses);

        if (
            cashAmount === null
            || creditAmount === null
            || cardAmount === null
            || transferAmount === null
            || nonGasSalesAmount === null
            || otherExpensesAmount === null
        ) {
            return NextResponse.json({ error: 'ยอดเงินต้องเป็นตัวเลขไม่ติดลบ' }, { status: 400 });
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
                return { error: 'ไม่พบปั๊มแก๊สนี้', statusCode: 404 as const };
            }

            const resolvedGasPrice = gasPriceInput
                ?? serializeDecimal(station.gasPrice)
                ?? DEFAULT_GAS_PRICE;

            let dailyRecord = await tx.dailyRecord.findFirst({
                where: {
                    stationId,
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
                orderBy: { date: 'asc' },
            });

            if (!dailyRecord) {
                dailyRecord = await tx.dailyRecord.create({
                    data: {
                        stationId,
                        date: startOfDay,
                        retailPrice: resolvedGasPrice,
                        wholesalePrice: resolvedGasPrice,
                        gasPrice: resolvedGasPrice,
                        status: status === 'OPEN' ? 'OPEN' : 'CLOSED',
                    },
                });
            } else {
                dailyRecord = await tx.dailyRecord.update({
                    where: { id: dailyRecord.id },
                    data: {
                        retailPrice: resolvedGasPrice,
                        wholesalePrice: resolvedGasPrice,
                        gasPrice: resolvedGasPrice,
                    },
                });
            }

            if (gasPriceInput !== null && serializeDecimal(station.gasPrice) !== gasPriceInput) {
                await tx.station.update({
                    where: { id: stationId },
                    data: { gasPrice: gasPriceInput },
                });
            }

            const existingShift = await tx.shift.findFirst({
                where: {
                    dailyRecordId: dailyRecord.id,
                    shiftNumber,
                },
                include: {
                    reconciliation: { select: { id: true } },
                },
            });

            if (status === 'OPEN') {
                if (existingShift?.reconciliation) {
                    return {
                        error: 'กะนี้กระทบยอดแล้ว ถ้าต้องแก้ย้อนหลังให้บันทึกเป็นกะปิดแทนการเปิดกะใหม่',
                        statusCode: 409 as const,
                    };
                }

                const otherOpenShift = await tx.shift.findFirst({
                    where: {
                        dailyRecordId: dailyRecord.id,
                        status: 'OPEN',
                        shiftNumber: { not: shiftNumber },
                    },
                    select: { id: true, shiftNumber: true },
                });

                if (otherOpenShift) {
                    return {
                        error: `ยังมีกะ ${otherOpenShift.shiftNumber} เปิดอยู่ในวันที่เลือก ต้องปิดกะนั้นก่อน`,
                        statusCode: 409 as const,
                    };
                }
            }

            const shiftData = {
                status,
                staffId: null,
                closedAt: status === 'CLOSED' ? new Date() : null,
                closedById: status === 'CLOSED' ? auth.user.id : null,
            };

            const shift = existingShift
                ? await tx.shift.update({
                    where: { id: existingShift.id },
                    data: shiftData,
                })
                : await tx.shift.create({
                    data: {
                        dailyRecordId: dailyRecord.id,
                        shiftNumber,
                        ...shiftData,
                    },
                });

            for (const meter of meters) {
                await tx.meterReading.upsert({
                    where: {
                        shiftId_nozzleNumber: {
                            shiftId: shift.id,
                            nozzleNumber: meter.nozzle,
                        },
                    },
                    create: {
                        shiftId: shift.id,
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: meter.nozzle,
                        startReading: meter.start ?? 0,
                        endReading: meter.end,
                        soldQty: meter.start !== null && meter.end !== null
                            ? Math.max(0, meter.end - meter.start)
                            : null,
                        capturedById: auth.user.id,
                        note: 'admin-data-entry',
                    },
                    update: {
                        startReading: meter.start ?? 0,
                        endReading: meter.end,
                        soldQty: meter.start !== null && meter.end !== null
                            ? Math.max(0, meter.end - meter.start)
                            : null,
                        capturedById: auth.user.id,
                        note: 'admin-data-entry',
                    },
                });
            }

            for (const gauge of gauges) {
                await tx.gaugeReading.deleteMany({
                    where: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        tankNumber: gauge.tank,
                        shiftNumber,
                        OR: [
                            { notes: 'start' },
                            { notes: null },
                        ],
                    },
                });

                await tx.gaugeReading.create({
                    data: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        date: dailyRecord.date,
                        tankNumber: gauge.tank,
                        percentage: gauge.start ?? 0,
                        shiftNumber,
                        recordedById: auth.user.id,
                        notes: 'start',
                    },
                });

                await tx.gaugeReading.deleteMany({
                    where: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        tankNumber: gauge.tank,
                        shiftNumber,
                        notes: 'end',
                    },
                });

                if (gauge.end !== null) {
                    await tx.gaugeReading.create({
                        data: {
                            stationId,
                            dailyRecordId: dailyRecord.id,
                            date: dailyRecord.date,
                            tankNumber: gauge.tank,
                            percentage: gauge.end,
                            shiftNumber,
                            recordedById: auth.user.id,
                            notes: 'end',
                        },
                    });
                }
            }

            const salesRows = [
                { key: 'cash', paymentType: 'CASH' as PaymentType, amount: cashAmount },
                { key: 'credit', paymentType: 'CREDIT' as PaymentType, amount: creditAmount },
                { key: 'card', paymentType: 'CREDIT_CARD' as PaymentType, amount: cardAmount },
                { key: 'transfer', paymentType: 'TRANSFER' as PaymentType, amount: transferAmount },
            ].filter((row) => row.amount > 0);

            await tx.transaction.updateMany({
                where: {
                    stationId,
                    dailyRecordId: dailyRecord.id,
                    shiftId: shift.id,
                    notes: { startsWith: 'admin-data-entry:' },
                    deletedAt: null,
                },
                data: { deletedAt: new Date() },
            });

            for (const row of salesRows) {
                await tx.transaction.create({
                    data: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        shiftId: shift.id,
                        date: dailyRecord.date,
                        liters: resolvedGasPrice > 0 ? Number((row.amount / resolvedGasPrice).toFixed(4)) : 0,
                        pricePerLiter: resolvedGasPrice,
                        amount: row.amount,
                        paymentType: row.paymentType,
                        productType: 'LPG',
                        recordedById: auth.user.id,
                        notes: `admin-data-entry:${row.key}`,
                    },
                });
            }

            const totalLiters = meters.reduce((sum, meter) => {
                if (meter.start !== null && meter.end !== null) {
                    return sum + Math.max(0, meter.end - meter.start);
                }
                return sum;
            }, 0);
            const expectedFuelAmount = Number((totalLiters * resolvedGasPrice).toFixed(2));
            const expectedOtherAmount = Number((nonGasSalesAmount - otherExpensesAmount).toFixed(2));
            const totalExpected = Number((expectedFuelAmount + expectedOtherAmount).toFixed(2));
            const combinedTransferReceived = Number((transferAmount + cardAmount).toFixed(2));
            const totalReceived = Number((cashAmount + creditAmount + combinedTransferReceived).toFixed(2));
            const variance = Number((totalReceived - totalExpected).toFixed(2));
            const varianceStatus = getVarianceStatus(variance);
            const normalizedVarianceNote = buildGasVarianceNote(
                typeof body.varianceNote === 'string' ? body.varianceNote : null,
                cardAmount,
                {
                    nonGasSalesAmount,
                    otherExpensesAmount,
                }
            );

            if (status === 'CLOSED') {
                await tx.shiftReconciliation.upsert({
                    where: { shiftId: shift.id },
                    update: {
                        expectedFuelAmount,
                        expectedOtherAmount,
                        totalExpected,
                        cashReceived: cashAmount,
                        creditReceived: creditAmount,
                        transferReceived: combinedTransferReceived,
                        totalReceived,
                        variance,
                        varianceStatus,
                    },
                    create: {
                        shiftId: shift.id,
                        expectedFuelAmount,
                        expectedOtherAmount,
                        totalExpected,
                        cashReceived: cashAmount,
                        creditReceived: creditAmount,
                        transferReceived: combinedTransferReceived,
                        totalReceived,
                        variance,
                        varianceStatus,
                    },
                });
            }

            await tx.shift.update({
                where: { id: shift.id },
                data: {
                    varianceNote: normalizedVarianceNote,
                },
            });

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'UPSERT',
                    model: 'Shift',
                    recordId: shift.id,
                    oldData: undefined,
                    newData: {
                        stationId,
                        dateKey,
                        shiftNumber,
                        status,
                        gasPrice: resolvedGasPrice,
                        meterRows: meters.length,
                        gaugeRows: gauges.length,
                        salesRows: salesRows.length,
                        source: 'gas-admin-data-entry',
                    },
                },
            });

            return {
                shiftId: shift.id,
                status,
                gasPrice: resolvedGasPrice,
                totalLiters,
                summary: {
                    expectedFuelAmount,
                    expectedOtherAmount,
                    totalExpected,
                    totalReceived,
                    variance,
                    varianceStatus,
                },
            };
        });

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.statusCode });
        }

        return NextResponse.json({
            success: true,
            message: result.status === 'OPEN'
                ? 'สร้าง/อัปเดตกะเปิดจากแอดมินสำเร็จ'
                : 'บันทึกข้อมูลกะและปิดกะจากแอดมินสำเร็จ',
            ...result,
        });
    } catch (error) {
        console.error('Error saving data entry:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
