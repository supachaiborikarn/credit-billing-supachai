import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayBangkok, getStartOfDayBangkokUTC, getEndOfDayBangkokUTC } from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { addToGasPaymentSummary, normalizeGasPaymentType } from '@/lib/gas/payment-utils';

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
            pricePerLiter,
            amount,
            ownerId,
            truckId,
            licensePlate,
            billNo,
            bookNo,
            notes
        } = body;

        const userId = auth.user.id;

        // Validate required fields
        if (!paymentType || !liters || !amount) {
            return NextResponse.json({ error: 'paymentType, liters, and amount are required' }, { status: 400 });
        }

        const normalizedPaymentType = normalizeGasPaymentType(paymentType);
        if (!normalizedPaymentType) {
            return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
        }

        // For credit, require owner
        if (normalizedPaymentType === 'CREDIT' && !ownerId) {
            return NextResponse.json({ error: 'ownerId is required for credit sales' }, { status: 400 });
        }

        // Get today's DailyRecord and current shift
        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                shifts: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!dailyRecord) {
            return NextResponse.json({ error: 'No daily record found. Please open a shift first.' }, { status: 400 });
        }

        const currentShift = dailyRecord.shifts[0];
        if (!currentShift) {
            return NextResponse.json({ error: 'No open shift. Please open a shift first.' }, { status: 400 });
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId: station.dbId,
                dailyRecordId: dailyRecord.id,
                shiftId: currentShift.id,
                ownerId: normalizedPaymentType === 'CREDIT' ? ownerId : null,
                truckId: normalizedPaymentType === 'CREDIT' ? truckId : null,
                licensePlate: licensePlate || null,
                date: new Date(),
                liters,
                pricePerLiter: pricePerLiter || Number(dailyRecord.gasPrice) || 16.09,
                amount,
                paymentType: normalizedPaymentType,
                productType: 'LPG',
                billBookNo: bookNo || null,
                billNo,
                notes: notes || null,
                recordedById: userId
            }
        });

        return NextResponse.json({
            success: true,
            transactionId: transaction.id,
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
                }
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
