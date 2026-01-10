import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getTodayBangkok, getStartOfDayBangkokUTC, getEndOfDayBangkokUTC } from '@/lib/gas';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';

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

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }
        const body = await request.json();
        const {
            paymentType,
            liters,
            pricePerLiter,
            amount,
            ownerId,
            truckId,
            licensePlate,
            billNo
        } = body;

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId: string | null = null;

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });
            userId = session?.userId || null;
        }

        // Validate required fields
        if (!paymentType || !liters || !amount) {
            return NextResponse.json({ error: 'paymentType, liters, and amount are required' }, { status: 400 });
        }

        if (!['CASH', 'CREDIT'].includes(paymentType)) {
            return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
        }

        // For credit, require owner
        if (paymentType === 'CREDIT' && !ownerId) {
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
                ownerId: paymentType === 'CREDIT' ? ownerId : null,
                truckId: paymentType === 'CREDIT' ? truckId : null,
                licensePlate: licensePlate || null,
                date: new Date(),
                liters,
                pricePerLiter: pricePerLiter || Number(dailyRecord.gasPrice) || 16.09,
                amount,
                paymentType,
                billNo,
                recordedById: userId || ''
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

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: station.dbId,
                createdAt: {
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

            if (t.paymentType === 'CASH') {
                summary.cash += amt;
            } else if (t.paymentType === 'CREDIT') {
                summary.credit += amt;
            }
        }

        return NextResponse.json({
            transactions: transactions.map(t => ({
                id: t.id,
                paymentType: t.paymentType,
                liters: Number(t.liters),
                amount: Number(t.amount),
                ownerName: t.owner?.name || null,
                licensePlate: t.licensePlate || null,
                billNo: t.billNo,
                createdAt: t.createdAt
            })),
            summary
        });
    } catch (error) {
        console.error('[Get Sales]:', error);
        return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
    }
}
