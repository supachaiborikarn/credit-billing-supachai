import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getEndOfDayBangkokUTC,
    getGasActiveShiftDateRange,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
} from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { addToGasPaymentSummary, normalizeGasPaymentType } from '@/lib/gas/payment-utils';
import {
    normalizeGasSaleAmount,
    normalizeGasSaleLiters,
    resolveDailyGasPrice,
    roundGasCurrency,
    roundGasQuantity,
} from '@/lib/gas/v2-workflow';

function normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

const DUPLICATE_GAS_SALE_WINDOW_MS = 5 * 60 * 1000;

/**
 * POST /api/v2/gas/[stationId]/sell
 * Record a sale transaction (GAS stations only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station } = auth;

        const body = await request.json();
        const {
            paymentType,
            liters,
            amount,
            ownerId,
            truckId,
            licensePlate,
            billNo,
            bookNo,
            notes
        } = body;

        const userId = auth.user.id;
        const normalizedOwnerId = normalizeOptionalText(ownerId);
        const normalizedTruckId = normalizeOptionalText(truckId);
        const normalizedBookNo = normalizeOptionalText(bookNo);
        const normalizedBillNo = normalizeOptionalText(billNo);
        const normalizedLicensePlate = normalizeOptionalText(licensePlate);
        const normalizedNotes = normalizeOptionalText(notes);

        const hasAmountInput = amount !== undefined
            && amount !== null
            && !(typeof amount === 'string' && amount.trim() === '');

        // Validate required fields
        if (!paymentType) {
            return NextResponse.json({ error: 'paymentType is required' }, { status: 400 });
        }

        const normalizedPaymentType = normalizeGasPaymentType(paymentType);
        if (!normalizedPaymentType) {
            return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
        }

        const inputAmount = hasAmountInput ? normalizeGasSaleAmount(amount) : null;
        if (hasAmountInput && inputAmount === null) {
            return NextResponse.json({ error: 'ยอดเงินขายต้องมากกว่า 0' }, { status: 400 });
        }

        const inputLiters = normalizeGasSaleLiters(liters);
        if (!hasAmountInput && inputLiters === null) {
            return NextResponse.json({ error: 'กรุณากรอกยอดเงินขาย' }, { status: 400 });
        }

        // For credit, require owner
        if (normalizedPaymentType === 'CREDIT') {
            if (!normalizedOwnerId) {
                return NextResponse.json({ error: 'ต้องเลือกลูกค้าเงินเชื่อ' }, { status: 400 });
            }
            if (!normalizedTruckId) {
                return NextResponse.json({ error: 'ต้องเลือกรถสำหรับบิลเงินเชื่อ' }, { status: 400 });
            }
            if (!normalizedBookNo || !normalizedBillNo) {
                return NextResponse.json({ error: 'ต้องกรอกเล่มที่และเลขที่บิลเงินเชื่อ' }, { status: 400 });
            }
        }

        // Get the current open shift. Night shifts can belong to yesterday's
        // business date and still be open after midnight.
        const today = getTodayBangkok();
        const activeShiftRange = getGasActiveShiftDateRange(today);

        const currentShift = await prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: {
                    stationId: station.dbId,
                    date: {
                        gte: activeShiftRange.start,
                        lte: activeShiftRange.end,
                    },
                },
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { createdAt: 'desc' },
            ],
            include: {
                dailyRecord: true,
            },
        });

        if (!currentShift) {
            return NextResponse.json({ error: 'No open shift. Please open a shift first.' }, { status: 400 });
        }

        const dailyRecord = currentShift.dailyRecord;
        const resolvedGasPrice = await resolveDailyGasPrice(prisma, station.dbId, dailyRecord.gasPrice);
        const resolvedAmount = inputAmount ?? roundGasCurrency(inputLiters! * resolvedGasPrice);
        const normalizedLiters = inputAmount !== null
            ? roundGasQuantity(resolvedAmount / resolvedGasPrice)
            : inputLiters!;
        let creditTruck: { licensePlate: string } | null = null;

        if (normalizedPaymentType === 'CREDIT') {
            const [owner, truck] = await Promise.all([
                prisma.owner.findFirst({
                    where: {
                        id: normalizedOwnerId!,
                        deletedAt: null,
                    },
                    select: { id: true },
                }),
                prisma.truck.findFirst({
                    where: {
                        id: normalizedTruckId!,
                        ownerId: normalizedOwnerId!,
                        deletedAt: null,
                    },
                    select: { licensePlate: true },
                }),
            ]);

            if (!owner) {
                return NextResponse.json({ error: 'ไม่พบลูกค้าเงินเชื่อในระบบ' }, { status: 400 });
            }
            if (!truck) {
                return NextResponse.json({ error: 'รถที่เลือกไม่ตรงกับลูกค้าเงินเชื่อ' }, { status: 400 });
            }

            creditTruck = truck;
        }

        const duplicateSince = new Date(Date.now() - DUPLICATE_GAS_SALE_WINDOW_MS);
        const recentDuplicate = await prisma.transaction.findFirst({
            where: {
                stationId: station.dbId,
                shiftId: currentShift.id,
                paymentType: normalizedPaymentType,
                amount: resolvedAmount,
                liters: normalizedLiters,
                productType: 'LPG',
                billBookNo: normalizedBookNo,
                billNo: normalizedBillNo,
                deletedAt: null,
                isVoided: false,
                createdAt: { gte: duplicateSince },
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });

        if (recentDuplicate) {
            return NextResponse.json({
                error: 'พบรายการยอดเดียวกันเพิ่งบันทึกไปแล้ว กรุณาตรวจหน้าสรุปก่อนบันทึกซ้ำ',
                duplicateTransactionId: recentDuplicate.id,
            }, { status: 409 });
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId: station.dbId,
                dailyRecordId: dailyRecord.id,
                shiftId: currentShift.id,
                ownerId: normalizedPaymentType === 'CREDIT' ? normalizedOwnerId : null,
                truckId: normalizedPaymentType === 'CREDIT' ? normalizedTruckId : null,
                licensePlate: normalizedPaymentType === 'CREDIT'
                    ? creditTruck!.licensePlate
                    : normalizedLicensePlate,
                date: new Date(),
                liters: normalizedLiters,
                pricePerLiter: resolvedGasPrice,
                amount: resolvedAmount,
                paymentType: normalizedPaymentType,
                productType: 'LPG',
                billBookNo: normalizedBookNo,
                billNo: normalizedBillNo,
                notes: normalizedNotes,
                recordedById: userId
            }
        });

        return NextResponse.json({
            success: true,
            transactionId: transaction.id,
            gasPrice: resolvedGasPrice,
            liters: normalizedLiters,
            amount: resolvedAmount,
            message: 'บันทึกสำเร็จ'
        });
    } catch (error) {
        console.error('[Sell]:', error);
        return NextResponse.json({ error: 'Failed to record sale' }, { status: 500 });
    }
}

/**
 * GET /api/v2/gas/[stationId]/sell
 * Get today's sales (GAS stations only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station } = auth;

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                deletedAt: null,
                isVoided: false,
            },
            include: {
                owner: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Aggregate by payment type
        const summary = {
            cash: 0,
            credit: 0,
            card: 0,
            transfer: 0,
            total: 0,
            liters: 0,
            count: 0
        };

        for (const t of transactions) {
            const amt = Number(t.amount);
            summary.total += amt;
            summary.liters += Number(t.liters);
            summary.count++;

            addToGasPaymentSummary(summary, t.paymentType, amt);
        }

        return NextResponse.json({
            transactions: transactions.map(t => ({
                id: t.id,
                paymentType: t.paymentType,
                liters: Number(t.liters),
                amount: Number(t.amount),
                ownerName: t.owner?.name || null,
                licensePlate: t.licensePlate || null,
                shiftId: t.shiftId,
                bookNo: t.billBookNo,
                billBookNo: t.billBookNo,
                billNo: t.billNo,
                notes: t.notes,
                createdAt: t.createdAt
            })),
            summary
        });
    } catch (error) {
        console.error('[Get Sales]:', error);
        return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
    }
}
