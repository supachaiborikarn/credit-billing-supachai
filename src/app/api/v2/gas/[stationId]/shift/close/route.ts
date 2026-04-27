import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';
import { requireStationAccessApi } from '@/lib/api-auth';
import { shiftBelongsToStation } from '@/lib/gas/api-guards';
import { resolveDailyGasPrice } from '@/lib/gas/v2-workflow';
import { buildGasVarianceNote } from '@/lib/gas/admin-analytics';

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

/**
 * POST /api/v2/gas/[stationId]/shift/close
 * Close the current shift with reconciliation data (GAS stations only)
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
        const { shiftId, reconciliation } = body;
        const userId = auth.user.id;

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
        }

        // Get shift
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                meters: true,
                dailyRecord: true
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        if (!shiftBelongsToStation(shift, station)) {
            return NextResponse.json({ error: 'Shift does not belong to this station' }, { status: 403 });
        }

        if (shift.status !== 'OPEN') {
            return NextResponse.json({ error: 'Shift is not open' }, { status: 400 });
        }

        // Validate all meters have end readings
        const missingEndMeters = shift.meters.filter(m => m.endReading === null);
        if (missingEndMeters.length > 0) {
            return NextResponse.json({
                error: `Missing end readings for nozzles: ${missingEndMeters.map(m => m.nozzleNumber).join(', ')}`
            }, { status: 400 });
        }

        // Check gauge end readings exist
        const endGaugeCount = await prisma.gaugeReading.count({
            where: {
                stationId: station.dbId,
                dailyRecordId: shift.dailyRecordId,
                shiftNumber: shift.shiftNumber,
                notes: 'end'
            }
        });

        if (endGaugeCount < 3) {
            return NextResponse.json({ error: 'ต้องบันทึกเกจปิดกะให้ครบ 3 ถัง' }, { status: 400 });
        }

        // Calculate expected amount from meters
        const gasPrice = await resolveDailyGasPrice(prisma, station.dbId, shift.dailyRecord.gasPrice);
        const totalLiters = shift.meters.reduce((sum, m) => {
            if (m.soldQty !== null && m.soldQty !== undefined) return sum + Number(m.soldQty);
            if (m.startReading !== null && m.endReading !== null) {
                return sum + (Number(m.endReading) - Number(m.startReading));
            }
            return sum;
        }, 0);
        const expectedFuelAmount = totalLiters * gasPrice;

        // Create or update reconciliation
        const {
            cashReceived: rawCashReceived,
            creditReceived: rawCreditReceived,
            cardReceived: rawCardReceived,
            transferReceived: rawTransferReceived,
            expectedOtherAmount: rawExpectedOtherAmount = 0,
            nonGasSalesAmount: rawNonGasSalesAmount = rawExpectedOtherAmount,
            otherSalesAmount: rawOtherSalesAmount,
            otherExpensesAmount: rawOtherExpensesAmount = 0,
            varianceNote,
        } = reconciliation || {};
        const cashReceived = toNonNegativeAmount(rawCashReceived);
        const creditReceived = toNonNegativeAmount(rawCreditReceived);
        const cardReceived = toNonNegativeAmount(rawCardReceived);
        const transferReceived = toNonNegativeAmount(rawTransferReceived);
        const nonGasSalesAmount = toNonNegativeAmount(rawOtherSalesAmount ?? rawNonGasSalesAmount);
        const otherExpensesAmount = toNonNegativeAmount(rawOtherExpensesAmount);

        if (
            cashReceived === null
            || creditReceived === null
            || cardReceived === null
            || transferReceived === null
            || nonGasSalesAmount === null
            || otherExpensesAmount === null
        ) {
            return NextResponse.json({
                error: 'ยอดรับจริง ยอดขายอื่น และค่าใช้จ่ายต้องเป็นจำนวนไม่ติดลบ',
            }, { status: 400 });
        }

        const expectedOtherAmount = Number((nonGasSalesAmount - otherExpensesAmount).toFixed(2));
        const combinedTransferReceived = Number((transferReceived + cardReceived).toFixed(2));
        const normalizedVarianceNote = buildGasVarianceNote(
            varianceNote,
            cardReceived,
            {
                nonGasSalesAmount,
                otherExpensesAmount,
            }
        );

        const totalExpected = Number((expectedFuelAmount + expectedOtherAmount).toFixed(2));
        const totalReceived = Number((cashReceived + creditReceived + combinedTransferReceived).toFixed(2));
        const variance = Number((totalReceived - totalExpected).toFixed(2));

        // Determine variance status
        let varianceStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        if (Math.abs(variance) > 500) {
            varianceStatus = 'RED';
        } else if (Math.abs(variance) > 100) {
            varianceStatus = 'YELLOW';
        }

        await prisma.shiftReconciliation.upsert({
            where: { shiftId },
            update: {
                expectedFuelAmount,
                expectedOtherAmount,
                totalExpected,
                cashReceived,
                creditReceived,
                transferReceived: combinedTransferReceived,
                totalReceived,
                variance,
                varianceStatus
            },
            create: {
                shiftId,
                expectedFuelAmount,
                expectedOtherAmount,
                totalExpected,
                cashReceived,
                creditReceived,
                transferReceived: combinedTransferReceived,
                totalReceived,
                variance,
                varianceStatus
            }
        });

        // Close shift
        await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: userId,
                varianceNote: normalizedVarianceNote || null
            }
        });

        return NextResponse.json({
            success: true,
            message: 'ปิดกะสำเร็จ',
            summary: {
                liters: totalLiters,
                expectedFuel: Number(expectedFuelAmount.toFixed(2)),
                expectedOther: expectedOtherAmount,
                nonGasSalesAmount,
                otherExpensesAmount,
                expected: totalExpected,
                received: totalReceived,
                variance
            }
        });
    } catch (error) {
        console.error('[Shift Close]:', error);
        return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 });
    }
}
