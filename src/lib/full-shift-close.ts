import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { listTransactionsForShiftWindow, summarizeShiftPayments } from '@/lib/shift-transaction-utils';

interface SubmittedMeter {
    nozzleNumber: number;
    startReading: number;
    endReading: number;
    price: number;
}

interface SubmittedProduct {
    id: string;
    openingStock: number;
    received: number;
    sold: number;
    price: number;
}

interface SubmittedCash {
    cashReceived: number;
    cardReceived: number;
    transferReceived: number;
    expenses: number;
    expenseNote?: string;
    discounts: number;
    discountNote?: string;
}

interface CloseFullShiftInput {
    stationId: string;
    shiftId: string;
    userId: string;
    meters: SubmittedMeter[];
    products: SubmittedProduct[];
    cash: SubmittedCash;
    anomalyNote?: string;
}

function toNumber(value: number | string | null | undefined): number {
    if (value == null) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getVarianceStatus(variance: number): 'GREEN' | 'YELLOW' | 'RED' {
    const abs = Math.abs(variance);
    if (abs <= 200) return 'GREEN';
    if (abs <= 500) return 'YELLOW';
    return 'RED';
}

function buildVarianceNote({
    variance,
    varianceStatus,
    anomalyNote,
    expenses,
    expenseNote,
    discounts,
    discountNote,
}: {
    variance: number;
    varianceStatus: 'GREEN' | 'YELLOW' | 'RED';
    anomalyNote?: string;
    expenses: number;
    expenseNote?: string;
    discounts: number;
    discountNote?: string;
}) {
    const notes: string[] = [];

    if (varianceStatus !== 'GREEN') {
        notes.push(`ยอดต่าง ${variance.toFixed(2)} บาท`);
    }

    if (expenses > 0) {
        notes.push(`ค่าใช้จ่าย ${expenses.toFixed(2)} บาท${expenseNote ? `: ${expenseNote}` : ''}`);
    }

    if (discounts > 0) {
        notes.push(`ส่วนลด ${discounts.toFixed(2)} บาท${discountNote ? `: ${discountNote}` : ''}`);
    }

    if (anomalyNote?.trim()) {
        notes.push(`anomaly: ${anomalyNote.trim()}`);
    }

    return notes.length > 0 ? notes.join(' | ') : null;
}

export async function closeFullShift(input: CloseFullShiftInput) {
    const shift = await prisma.shift.findUnique({
        where: { id: input.shiftId },
        include: {
            dailyRecord: {
                select: { stationId: true },
            },
        },
    });

    if (!shift?.dailyRecord) {
        throw new Error('❌ ไม่พบกะนี้ในระบบ');
    }

    if (shift.dailyRecord.stationId !== input.stationId) {
        throw new Error('❌ กะนี้ไม่ได้อยู่ในสถานีนี้');
    }

    if (shift.status !== 'OPEN') {
        throw new Error('❌ กะนี้ปิดไปแล้ว');
    }

    const normalizedMeters = (input.meters || []).map((meter) => {
        const startReading = toNumber(meter.startReading);
        const endReading = toNumber(meter.endReading);
        const price = toNumber(meter.price);

        if (endReading > 0 && endReading < startReading) {
            throw new Error(`❌ มิเตอร์หัว ${meter.nozzleNumber} มีเลขปิดน้อยกว่าเลขเปิด`);
        }

        const liters = endReading > startReading ? endReading - startReading : 0;

        return {
            nozzleNumber: meter.nozzleNumber,
            startReading,
            endReading,
            liters,
            amount: liters * price,
        };
    });

    const normalizedProducts = (input.products || []).map((product) => {
        const openingStock = toNumber(product.openingStock);
        const received = toNumber(product.received);
        const sold = toNumber(product.sold);
        const price = toNumber(product.price);
        const closingStock = openingStock + received - sold;

        if (received < 0 || sold < 0) {
            throw new Error('❌ จำนวนสินค้ารับเข้า/ขายต้องไม่ติดลบ');
        }

        if (closingStock < 0) {
            throw new Error('❌ สต็อกสินค้าคงเหลือติดลบ กรุณาตรวจสอบ');
        }

        return {
            id: product.id,
            received,
            sold,
            closingStock,
            amount: sold * price,
            price,
        };
    });

    const payments = summarizeShiftPayments(
        await listTransactionsForShiftWindow({
            shiftId: shift.id,
            stationId: input.stationId,
            openedAt: shift.createdAt,
            closedAt: shift.closedAt,
        })
    );

    const cashReceived = toNumber(input.cash.cashReceived);
    const transferReceived =
        toNumber(input.cash.cardReceived) +
        toNumber(input.cash.transferReceived);
    const creditReceived = payments.credit;
    const expenses = toNumber(input.cash.expenses);
    const discounts = toNumber(input.cash.discounts);

    const expectedFuelAmount = normalizedMeters.reduce((sum, meter) => sum + meter.amount, 0);
    const expectedOtherAmount = normalizedProducts.reduce((sum, product) => sum + product.amount, 0);
    const totalExpected = expectedFuelAmount + expectedOtherAmount;
    const totalReceived = cashReceived + creditReceived + transferReceived - expenses - discounts;
    const variance = totalExpected - totalReceived;
    const varianceStatus = getVarianceStatus(variance);
    const varianceNote = buildVarianceNote({
        variance,
        varianceStatus,
        anomalyNote: input.anomalyNote,
        expenses,
        expenseNote: input.cash.expenseNote,
        discounts,
        discountNote: input.cash.discountNote,
    });

    await prisma.$transaction(async (tx) => {
        for (const meter of normalizedMeters) {
            if (meter.endReading <= 0) continue;

            await tx.meterReading.upsert({
                where: {
                    shiftId_nozzleNumber: {
                        shiftId: shift.id,
                        nozzleNumber: meter.nozzleNumber,
                    },
                },
                create: {
                    shiftId: shift.id,
                    dailyRecordId: shift.dailyRecordId,
                    nozzleNumber: meter.nozzleNumber,
                    startReading: meter.startReading,
                    endReading: meter.endReading,
                    soldQty: meter.liters,
                    capturedById: input.userId,
                    capturedAt: new Date(),
                },
                update: {
                    startReading: meter.startReading,
                    endReading: meter.endReading,
                    soldQty: meter.liters,
                    capturedById: input.userId,
                    capturedAt: new Date(),
                },
            });
        }

        for (const product of normalizedProducts) {
            if (product.sold > 0) {
                await tx.productSale.create({
                    data: {
                        productId: product.id,
                        stationId: input.stationId,
                        quantity: product.sold,
                        salePrice: product.price,
                        paymentType: 'CASH',
                        date: new Date(),
                    },
                });

                await tx.productInventory.update({
                    where: {
                        productId_stationId: {
                            productId: product.id,
                            stationId: input.stationId,
                        },
                    },
                    data: {
                        quantity: product.closingStock,
                    },
                });
            }

            if (product.received > 0) {
                await tx.productReceipt.create({
                    data: {
                        productId: product.id,
                        stationId: input.stationId,
                        quantity: product.received,
                        date: new Date(),
                    },
                });
            }
        }

        await tx.shiftReconciliation.upsert({
            where: { shiftId: shift.id },
            create: {
                shiftId: shift.id,
                expectedFuelAmount,
                expectedOtherAmount,
                totalExpected,
                totalReceived,
                cashReceived,
                creditReceived,
                transferReceived,
                variance,
                varianceStatus,
            },
            update: {
                expectedFuelAmount,
                expectedOtherAmount,
                totalExpected,
                totalReceived,
                cashReceived,
                creditReceived,
                transferReceived,
                variance,
                varianceStatus,
            },
        });

        await tx.shift.update({
            where: { id: shift.id },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: input.userId,
                varianceNote,
            },
        });

        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'CLOSE',
                model: 'Shift',
                recordId: shift.id,
                newData: {
                    expectedFuelAmount,
                    expectedOtherAmount,
                    totalExpected,
                    totalReceived,
                    variance,
                    varianceStatus,
                    payments,
                    expenses,
                    discounts,
                    varianceNote,
                    carryOverMeters: normalizedMeters.map((meter) => ({
                        nozzleNumber: meter.nozzleNumber,
                        lastReading: meter.endReading,
                    })),
                } as unknown as Prisma.InputJsonValue,
            },
        });
    });

    return {
        success: true,
        message: '✅ ปิดกะเรียบร้อย',
        variance,
        varianceStatus,
        totalExpected,
        totalReceived,
        payments,
    };
}
