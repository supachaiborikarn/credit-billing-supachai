import { prisma } from '@/lib/prisma';
import { VarianceStatus } from '@prisma/client';
import { formatDateBangkok } from '@/lib/date-utils';
import {
    getWatcharaExternalDailySummary,
    shouldApplyWatcharaExternalToShift,
} from '@/lib/operational-sales';
import { listTransactionsForShift, summarizeShiftPayments } from '@/lib/shift-transaction-utils';

/**
 * Calculate variance status based on absolute variance amount
 * Port from Supachaigroup: VarianceStatus.fromAmount()
 */
export function getVarianceStatus(variance: number): VarianceStatus {
    const abs = Math.abs(variance);
    if (abs <= 200) return VarianceStatus.GREEN;
    if (abs <= 500) return VarianceStatus.YELLOW;
    return VarianceStatus.RED;
}

interface ReconciliationResult {
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    totalExpected: number;
    totalReceived: number;
    cashReceived: number;
    creditReceived: number;
    transferReceived: number;
    variance: number;
    varianceStatus: VarianceStatus;
}

/**
 * Calculate reconciliation for a shift
 * Port from Supachaigroup: ShiftReconciliation.calculateForShiftRun()
 */
export async function calculateForShift(shiftId: string): Promise<ReconciliationResult> {
    // Get shift with related data
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            meters: {
                include: {
                    nozzle: {
                        include: {
                            product: true
                        }
                    }
                }
            },
            dailyRecord: {
                select: {
                    date: true,
                    stationId: true,
                    gasPrice: true,
                    retailPrice: true
                }
            }
        }
    });

    if (!shift || !shift.dailyRecord) {
        throw new Error('Shift not found');
    }

    // 1. Calculate expected fuel amount from meter readings
    let expectedFuelAmount = 0;

    for (const meter of shift.meters) {
        const soldQty = Number(meter.soldQty || 0);
        if (soldQty <= 0) continue;

        // Try to get price from nozzle's product price book
        let pricePerUnit = Number(shift.dailyRecord.retailPrice || 30.5); // Default

        // If nozzle is linked, try to get active price book line
        if (meter.nozzleId && meter.nozzle?.productId) {
            const priceBookLine = await prisma.priceBookLine.findFirst({
                where: {
                    productId: meter.nozzle.productId,
                    priceBook: {
                        status: 'ACTIVE',
                        effectiveFrom: { lte: shift.dailyRecord.date },
                        AND: [
                            {
                                OR: [
                                    { stationId: null }, // Global price book
                                    { stationId: shift.dailyRecord.stationId }
                                ]
                            },
                            {
                                OR: [
                                    { effectiveTo: null },
                                    { effectiveTo: { gte: shift.dailyRecord.date } }
                                ]
                            }
                        ]
                    }
                },
                orderBy: {
                    priceBook: { effectiveFrom: 'desc' }
                }
            });

            if (priceBookLine) {
                pricePerUnit = Number(priceBookLine.pricePerUnit);
            }
        }

        expectedFuelAmount += soldQty * pricePerUnit;
    }

    // 2. Get product sales for this shift (expectedOtherAmount)
    // For now, we'll use product sales from the same day
    const expectedOtherAmount = 0; // TODO: Implement product sales calculation

    // 3. Get transactions for this shift's time period
    const payments = summarizeShiftPayments(await listTransactionsForShift(shiftId));
    let cashReceived = payments.cash;
    let creditReceived = payments.credit;
    let transferReceived = payments.transfer + payments.card;

    const dateKey = formatDateBangkok(shift.dailyRecord.date);
    const shouldApplyExternal = await shouldApplyWatcharaExternalToShift({
        stationId: shift.dailyRecord.stationId,
        dailyRecordId: shift.dailyRecordId,
        shiftNumber: shift.shiftNumber,
        dateKey,
    });

    if (shouldApplyExternal) {
        const externalSummary = await getWatcharaExternalDailySummary({
            stationId: shift.dailyRecord.stationId,
            dateKey,
        });

        expectedFuelAmount += externalSummary.summary.revenue;
        cashReceived += externalSummary.payments.cash;
        creditReceived += externalSummary.payments.credit + externalSummary.payments.boxTruck + externalSummary.payments.oilTruckSupachai;
        transferReceived += externalSummary.payments.transfer + externalSummary.payments.card;
    }

    const totalReceived = cashReceived + creditReceived + transferReceived;
    const totalExpected = expectedFuelAmount + expectedOtherAmount;
    const variance = totalReceived - totalExpected;
    const varianceStatus = getVarianceStatus(variance);

    return {
        expectedFuelAmount: Math.round(expectedFuelAmount * 100) / 100,
        expectedOtherAmount: Math.round(expectedOtherAmount * 100) / 100,
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        cashReceived: Math.round(cashReceived * 100) / 100,
        creditReceived: Math.round(creditReceived * 100) / 100,
        transferReceived: Math.round(transferReceived * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        varianceStatus
    };
}

/**
 * Save or update ShiftReconciliation record
 */
export async function saveShiftReconciliation(shiftId: string) {
    const result = await calculateForShift(shiftId);

    return await prisma.shiftReconciliation.upsert({
        where: { shiftId },
        create: {
            shiftId,
            expectedFuelAmount: result.expectedFuelAmount,
            expectedOtherAmount: result.expectedOtherAmount,
            totalExpected: result.totalExpected,
            totalReceived: result.totalReceived,
            cashReceived: result.cashReceived,
            creditReceived: result.creditReceived,
            transferReceived: result.transferReceived,
            variance: result.variance,
            varianceStatus: result.varianceStatus
        },
        update: {
            expectedFuelAmount: result.expectedFuelAmount,
            expectedOtherAmount: result.expectedOtherAmount,
            totalExpected: result.totalExpected,
            totalReceived: result.totalReceived,
            cashReceived: result.cashReceived,
            creditReceived: result.creditReceived,
            transferReceived: result.transferReceived,
            variance: result.variance,
            varianceStatus: result.varianceStatus
        }
    });
}
