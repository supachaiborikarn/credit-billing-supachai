import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { getSessionWithError } from '@/lib/auth-utils';
import { PaymentType } from '@prisma/client';

interface TransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    productType?: string;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig || stationConfig.type !== 'GAS') {
            return HttpErrors.notFound('Gas station not found');
        }

        // Get user from session (using shared auth helper)
        const { user: sessionUser, error: authError } = await getSessionWithError();

        if (!sessionUser || authError) {
            return HttpErrors.unauthorized(authError || 'กรุณาเข้าสู่ระบบ');
        }

        const body: TransactionInput = await request.json();
        const {
            date: dateStr,
            licensePlate,
            ownerName,
            ownerId,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            productType
        } = body;

        // Validate required fields
        if (!paymentType || !liters || liters <= 0) {
            return HttpErrors.badRequest('ข้อมูลไม่ครบถ้วน');
        }

        // CREDIT transactions require owner name
        if (paymentType === 'CREDIT' && !ownerName && !ownerId) {
            return HttpErrors.badRequest('รายการเงินเชื่อต้องระบุชื่อเจ้าของ');
        }

        // Get or create station with consistent ID
        const stationId = `station-${id}`;
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: 'GAS',
                gasPrice: pricePerLiter || 15.50,
                gasStockAlert: 1000,
            }
        });

        // Get or create daily record (use Bangkok timezone)
        const { getStartOfDayBangkok } = await import('@/lib/date-utils');
        const date = getStartOfDayBangkok(dateStr);
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date,
            }
        });

        if (!dailyRecord) {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.id,
                    date: date,
                    gasPrice: pricePerLiter,
                    retailPrice: 0,
                    wholesalePrice: 0,
                }
            });
        }

        // Find truck if license plate provided
        let truckId = null;
        if (licensePlate) {
            const truck = await prisma.truck.findFirst({
                where: {
                    licensePlate: licensePlate.toUpperCase()
                }
            });
            if (truck) {
                truckId = truck.id;
            }
        }

        // Resolve ownerId from ownerName if provided
        let resolvedOwnerId = ownerId || null;
        if (!resolvedOwnerId && ownerName && ['CREDIT', 'BOX_TRUCK'].includes(paymentType)) {
            const owner = await prisma.owner.findFirst({
                where: { name: { contains: ownerName }, deletedAt: null }
            });
            if (owner) resolvedOwnerId = owner.id;
        }

        // ===== CREDIT LIMIT CHECK =====
        if (resolvedOwnerId && ['CREDIT', 'BOX_TRUCK'].includes(paymentType)) {
            const { checkCreditLimit, updateOwnerCredit } = await import('@/services/credit-service');
            const creditCheck = await checkCreditLimit(resolvedOwnerId, amount);

            if (!creditCheck.allowed) {
                return NextResponse.json({
                    error: creditCheck.error,
                    creditLimit: creditCheck.creditLimit,
                    currentCredit: creditCheck.currentCredit,
                    remainingCredit: creditCheck.remainingCredit
                }, { status: 400 });
            }
        }
        // ===== END CREDIT LIMIT CHECK =====

        // ===== DUPLICATE PREVENTION =====
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const duplicateCheck = await prisma.transaction.findFirst({
            where: {
                stationId: station.id,
                licensePlate: licensePlate?.toUpperCase() || null,
                ownerName: ownerName || null,
                amount: amount,
                createdAt: { gte: twoMinutesAgo },
                deletedAt: null,
            }
        });

        if (duplicateCheck) {
            return HttpErrors.conflict('รายการนี้ถูกบันทึกไปแล้ว (ป้องกันการส่งซ้ำ)');
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId: station.id,
                dailyRecordId: dailyRecord.id,
                date: new Date(),
                truckId,
                licensePlate: licensePlate?.toUpperCase() || null,
                ownerId: resolvedOwnerId,
                ownerName: ownerName || null,
                paymentType: paymentType as PaymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                productType: productType || 'LPG',
                recordedById: sessionUser.id,
            }
        });

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('[Gas Transaction POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
