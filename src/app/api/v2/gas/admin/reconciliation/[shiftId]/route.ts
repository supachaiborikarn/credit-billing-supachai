import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import {
    buildGasShiftAnalytics,
    buildGasVarianceNote,
    getGasAnalyticsStationIds,
    parseGasVarianceNote,
} from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';

function toNonNegativeNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return Number(parsed.toFixed(2));
}

function toOptionalNonNegativeNumber(value: unknown, fallback: number): number | null {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return toNonNegativeNumber(value);
}

function getVarianceSeverity(variance: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (Math.abs(variance) > 500) return 'RED';
    if (Math.abs(variance) > 100) return 'YELLOW';
    return 'GREEN';
}

function getVarianceDirection(variance: number): 'OVER' | 'SHORT' | 'BALANCED' {
    if (variance > 1) return 'OVER';
    if (variance < -1) return 'SHORT';
    return 'BALANCED';
}

/**
 * PUT /api/v2/gas/admin/reconciliation/[shiftId]
 * Update reconciliation received amounts for a gas shift
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { shiftId } = await params;
        const body = await request.json();

        const cashReceived = toNonNegativeNumber(body.cashReceived);
        const creditReceived = toNonNegativeNumber(body.creditReceived);
        const cardReceived = toNonNegativeNumber(body.cardReceived);
        const transferReceived = toNonNegativeNumber(body.transferReceived);

        if (
            cashReceived === null
            || creditReceived === null
            || cardReceived === null
            || transferReceived === null
        ) {
            return NextResponse.json({
                error: 'ยอดรับจริงทุกประเภทต้องเป็นจำนวนไม่ติดลบ',
            }, { status: 400 });
        }

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                dailyRecord: {
                    include: {
                        station: {
                            select: { name: true },
                        },
                    },
                },
                staff: {
                    select: { name: true },
                },
                meters: {
                    orderBy: { nozzleNumber: 'asc' },
                },
                reconciliation: true,
            },
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const dateKey = toBangkokDateKey(shift.dailyRecord.date);
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: {
                    in: getGasAnalyticsStationIds(shift.dailyRecord.stationId),
                },
                date: {
                    gte: getStartOfDayBangkokUTC(dateKey),
                    lte: getEndOfDayBangkokUTC(dateKey),
                },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                id: true,
                stationId: true,
                dailyRecordId: true,
                shiftId: true,
                date: true,
                paymentType: true,
                liters: true,
                amount: true,
            },
            orderBy: { date: 'asc' },
        });

        const [analytics] = buildGasShiftAnalytics([shift], transactions);
        if (!analytics) {
            return NextResponse.json({ error: 'Unable to build analytics for shift' }, { status: 500 });
        }

        const parsedVarianceNote = parseGasVarianceNote(shift.varianceNote);
        const currentExpectedOtherAmount = shift.reconciliation
            ? Number(shift.reconciliation.expectedOtherAmount)
            : 0;
        const currentNonGasSalesAmount = parsedVarianceNote.nonGasSalesAmount > 0
            ? parsedVarianceNote.nonGasSalesAmount
            : Math.max(currentExpectedOtherAmount, 0);
        const currentOtherExpensesAmount = parsedVarianceNote.otherExpensesAmount > 0
            ? parsedVarianceNote.otherExpensesAmount
            : Math.max(-currentExpectedOtherAmount, 0);
        const nonGasSalesAmount = toOptionalNonNegativeNumber(
            body.nonGasSalesAmount ?? body.otherSalesAmount,
            currentNonGasSalesAmount
        );
        const otherExpensesAmount = toOptionalNonNegativeNumber(
            body.otherExpensesAmount,
            currentOtherExpensesAmount
        );

        if (nonGasSalesAmount === null || otherExpensesAmount === null) {
            return NextResponse.json({
                error: 'ยอดขายอื่นและค่าใช้จ่ายต้องเป็นจำนวนไม่ติดลบ',
            }, { status: 400 });
        }

        const expectedFuelAmount = shift.reconciliation
            ? Number(shift.reconciliation.expectedFuelAmount)
            : analytics.sales.total;
        // คงยอดขายสินค้าจากการนับสต็อกไว้ ส่วนที่แก้เกินจากนั้นถือเป็นรายรับอื่น
        const currentProductSalesAmount = shift.reconciliation
            ? Number(shift.reconciliation.productSalesAmount ?? 0)
            : 0;
        const otherIncomeAmount = Number(
            Math.max(nonGasSalesAmount - currentProductSalesAmount, 0).toFixed(2)
        );
        const expectedOtherAmount = Number((nonGasSalesAmount - otherExpensesAmount).toFixed(2));
        const totalExpected = Number((expectedFuelAmount + expectedOtherAmount).toFixed(2));
        const combinedTransferReceived = Number((transferReceived + cardReceived).toFixed(2));
        const totalReceived = Number((
            cashReceived
            + creditReceived
            + combinedTransferReceived
        ).toFixed(2));
        const variance = Number((totalReceived - totalExpected).toFixed(2));
        const varianceNote = buildGasVarianceNote(
            body.varianceNote ?? analytics.reconciliation?.varianceNote ?? shift.varianceNote,
            cardReceived,
            {
                nonGasSalesAmount,
                otherExpensesAmount,
            }
        );

        await prisma.$transaction([
            prisma.shiftReconciliation.upsert({
                where: { shiftId },
                update: {
                    expectedFuelAmount,
                    expectedOtherAmount,
                    totalExpected,
                    totalReceived,
                    cashReceived,
                    creditReceived,
                    transferReceived: combinedTransferReceived,
                    otherIncomeAmount,
                    otherExpensesAmount,
                    variance,
                    varianceStatus: getVarianceSeverity(variance),
                },
                create: {
                    shiftId,
                    expectedFuelAmount,
                    expectedOtherAmount,
                    totalExpected,
                    totalReceived,
                    cashReceived,
                    creditReceived,
                    transferReceived: combinedTransferReceived,
                    otherIncomeAmount,
                    otherExpensesAmount,
                    variance,
                    varianceStatus: getVarianceSeverity(variance),
                },
            }),
            prisma.shift.update({
                where: { id: shiftId },
                data: {
                    varianceNote,
                },
            }),
        ]);

        // เก็บประวัติการแก้ไข (ค่าเดิม → ค่าใหม่) ไว้ตรวจสอบย้อนหลัง
        await prisma.auditLog.create({
            data: {
                userId: auth.user.id,
                action: 'UPDATE',
                model: 'ShiftReconciliation',
                recordId: shiftId,
                oldData: shift.reconciliation
                    ? {
                        cashReceived: Number(shift.reconciliation.cashReceived),
                        creditReceived: Number(shift.reconciliation.creditReceived),
                        transferReceived: Number(shift.reconciliation.transferReceived),
                        totalReceived: Number(shift.reconciliation.totalReceived),
                        expectedOtherAmount: Number(shift.reconciliation.expectedOtherAmount),
                        variance: Number(shift.reconciliation.variance),
                        varianceNote: shift.varianceNote,
                    }
                    : undefined,
                newData: {
                    cashReceived,
                    creditReceived,
                    cardReceived,
                    transferReceived: combinedTransferReceived,
                    nonGasSalesAmount,
                    otherExpensesAmount,
                    totalReceived,
                    variance,
                    varianceNote,
                    source: 'gas-admin-reconciliation',
                },
            },
        });

        return NextResponse.json({
            success: true,
            reconciliation: {
                expected: totalExpected,
                expectedFuelAmount,
                expectedOtherAmount,
                nonGasSalesAmount,
                otherExpensesAmount,
                received: totalReceived,
                variance,
                varianceStatus: getVarianceDirection(variance),
                varianceSeverity: getVarianceSeverity(variance),
                cashReceived,
                creditReceived,
                cardReceived,
                transferReceived,
                varianceNote,
            },
        });
    } catch (error) {
        console.error('[Gas Admin Reconciliation Update]:', error);
        return NextResponse.json({ error: 'Failed to update reconciliation' }, { status: 500 });
    }
}
