import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, createTransactionDate } from '@/lib/date-utils';
import { PaymentType } from '@prisma/client';

interface TransactionLine {
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
}

interface BulkTransactionRequest {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string;
    paymentType: string;
    billBookNo?: string;
    billNo?: string;
    transferProofUrl?: string;
    lines: TransactionLine[];
}

// POST - Save multiple transactions atomically
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body: BulkTransactionRequest = await request.json();

        const {
            date: dateStr,
            licensePlate,
            ownerName,
            ownerId,
            paymentType,
            billBookNo,
            billNo,
            transferProofUrl,
            lines
        } = body;

        // Validate
        if (!lines || lines.length === 0) {
            return NextResponse.json({ error: 'ต้องมีอย่างน้อย 1 รายการ' }, { status: 400 });
        }

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true, expiresAt: true }
        });

        if (!session || session.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
        }

        const userId = session.userId;

        // Get or create daily record for FULL station
        const date = getStartOfDayBangkok(dateStr);
        let dailyRecordId: string | null = null;

        const station = await prisma.station.findUnique({ where: { id: stationId } });

        if (station?.type === 'FULL') {
            const dailyRecord = await prisma.dailyRecord.upsert({
                where: { stationId_date: { stationId, date } },
                update: {},
                create: {
                    stationId,
                    date,
                    retailPrice: 31.34,
                    wholesalePrice: 30.5,
                    status: 'OPEN',
                }
            });
            dailyRecordId = dailyRecord.id;
        }

        // Find owner if provided
        let resolvedOwnerId: string | null = ownerId || null;
        if (!resolvedOwnerId && paymentType === 'CREDIT' && ownerName) {
            const owner = await prisma.owner.findFirst({
                where: { name: { contains: ownerName }, deletedAt: null }
            });
            if (owner) resolvedOwnerId = owner.id;
        }

        // Auto-create truck if license plate + owner provided but truck doesn't exist
        let truckId: string | null = null;
        if (licensePlate && resolvedOwnerId) {
            // Check if truck exists
            const existingTruck = await prisma.truck.findFirst({
                where: { licensePlate: licensePlate.toUpperCase() }
            });

            if (existingTruck) {
                truckId = existingTruck.id;
            } else {
                // Create new truck automatically
                const newTruck = await prisma.truck.create({
                    data: {
                        licensePlate: licensePlate.toUpperCase(),
                        ownerId: resolvedOwnerId,
                    }
                });
                truckId = newTruck.id;
                console.log(`Auto-created truck: ${licensePlate} for owner ${resolvedOwnerId}`);
            }
        }

        // Check for duplicates - only if we have identifiable info
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);
        const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

        // Build OR conditions only if we have data
        const orConditions = [];
        if (licensePlate) orConditions.push({ licensePlate });
        if (ownerName) orConditions.push({ ownerName });

        // Only check for duplicates if we have licensePlate or ownerName
        if (orConditions.length > 0) {
            const duplicate = await prisma.transaction.findFirst({
                where: {
                    stationId,
                    date: { gte: startOfDay, lte: endOfDay },
                    amount: totalAmount,
                    paymentType: paymentType as PaymentType,
                    deletedAt: null,
                    isVoided: false, // Don't count voided transactions
                    OR: orConditions
                }
            });

            if (duplicate) {
                return NextResponse.json({
                    error: `รายการซ้ำ: พบรายการ ${paymentType} ยอด ${totalAmount.toFixed(2)} บาท ในวันที่ ${dateStr} แล้ว`
                }, { status: 409 });
            }
        }

        // Use database transaction for atomicity (All or Nothing)
        const transactions = await prisma.$transaction(async (tx) => {
            const results = [];

            for (const line of lines) {
                const transaction = await tx.transaction.create({
                    data: {
                        stationId,
                        dailyRecordId,
                        date: createTransactionDate(dateStr),
                        licensePlate: licensePlate || null,
                        ownerName: ownerName || null,
                        ownerId: resolvedOwnerId,
                        truckId: truckId,
                        paymentType: paymentType as PaymentType,
                        nozzleNumber: null,
                        liters: line.liters,
                        pricePerLiter: line.pricePerLiter,
                        amount: line.amount,
                        billBookNo: billBookNo || null,
                        billNo: billNo || null,
                        productType: line.fuelType,
                        transferProofUrl: transferProofUrl || null,
                        recordedById: userId,
                    }
                });
                results.push(transaction);
            }

            return results;
        });

        return NextResponse.json({
            success: true,
            transactionCount: transactions.length,
            totalAmount: lines.reduce((sum, l) => sum + l.amount, 0)
        });
    } catch (error) {
        console.error('Bulk transaction POST error:', error);
        return NextResponse.json({ error: 'Failed to save transactions' }, { status: 500 });
    }
}
