import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { PaymentType } from '@prisma/client';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { getEndOfDayBangkokUTC, getStartOfDayBangkokUTC } from '@/lib/gas';
import { createTransactionDate } from '@/lib/date-utils';

interface TransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string;
    paymentType: string;
    nozzleNumber?: number;
    liters?: number;
    pricePerLiter?: number;
    amount: number;
    productType?: string;
    notes?: string;
    shiftId?: string;  // Changed from shiftNumber to shiftId
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const body: TransactionInput = await request.json();
        const {
            date: dateStr,
            licensePlate,
            ownerName,
            ownerId,
            paymentType,
            nozzleNumber = 0,
            liters = 0,
            pricePerLiter = 0,
            amount,
            productType,
            notes,
            shiftId  // Changed from shiftNumber to shiftId
        } = body;
        const amountNumber = Number(amount);
        const requestedPricePerLiter = Number(pricePerLiter) || 0;
        const providedLiters = Number(liters) || 0;
        const isExpense = paymentType === 'EXPENSE';

        // Validate required fields - EXPENSE can be negative, sales must be positive.
        if (
            !paymentType
            || !Number.isFinite(amountNumber)
            || (isExpense ? amountNumber === 0 : amountNumber <= 0)
        ) {
            return HttpErrors.badRequest('ข้อมูลไม่ครบถ้วน: ต้องระบุประเภทการชำระเงินและจำนวนเงิน');
        }

        // CREDIT transactions require owner name
        if (paymentType === 'CREDIT' && !ownerName && !ownerId) {
            return HttpErrors.badRequest('รายการเงินเชื่อต้องระบุชื่อเจ้าของ');
        }

        // Get or create station with consistent ID
        const stationId = auth.station.dbId;
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: auth.station.name,
                type: 'GAS',
                gasPrice: requestedPricePerLiter || 15.50,
                gasStockAlert: 1000,
            }
        });

        // Get or create daily record using a Bangkok-day range. Older records may not
        // be stored at the exact same Date object, so exact unique lookup is fragile.
        const date = getStartOfDayBangkokUTC(dateStr);
        const endOfDay = getEndOfDayBangkokUTC(dateStr);
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: {
                    gte: date,
                    lte: endOfDay,
                },
            },
            orderBy: { date: 'asc' },
        });

        if (!dailyRecord) {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.id,
                    date: date,
                    gasPrice: requestedPricePerLiter || Number(station.gasPrice) || 15.50,
                    retailPrice: 0,
                    wholesalePrice: 0,
                }
            });
        }

        const effectivePricePerLiter = requestedPricePerLiter
            || Number(dailyRecord.gasPrice)
            || Number(station.gasPrice)
            || 0;
        const effectiveLiters = !isExpense && effectivePricePerLiter > 0
            ? Number((amountNumber / effectivePricePerLiter).toFixed(5))
            : (providedLiters > 0 ? Number(providedLiters.toFixed(5)) : 0);

        if (!isExpense && effectiveLiters <= 0) {
            return HttpErrors.badRequest('ไม่สามารถคำนวณลิตรได้ กรุณาตั้งราคาขายประจำวันก่อนบันทึกขาย');
        }

        let effectiveShiftId = shiftId || null;

        if (effectiveShiftId) {
            const shift = await prisma.shift.findUnique({
                where: { id: effectiveShiftId },
                include: { dailyRecord: { select: { stationId: true } } }
            });

            if (!shift || shift.dailyRecord.stationId !== station.id) {
                return NextResponse.json({ error: 'กะไม่ตรงกับสถานีนี้' }, { status: 403 });
            }

            if (shift.dailyRecordId !== dailyRecord.id) {
                return HttpErrors.badRequest('กะไม่ตรงกับวันที่บันทึกรายการ');
            }

            if (shift.status !== 'OPEN') {
                return HttpErrors.badRequest('ไม่สามารถเพิ่มรายการในกะที่ปิดแล้ว');
            }
        } else if (paymentType !== 'EXPENSE') {
            const openShift = await prisma.shift.findFirst({
                where: {
                    dailyRecordId: dailyRecord.id,
                    status: 'OPEN',
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!openShift) {
                return HttpErrors.badRequest('กรุณาเปิดกะก่อนบันทึกขาย เพื่อให้รายการผูกกับกะและขึ้นรายงานผู้จัดการ');
            }

            effectiveShiftId = openShift.id;
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
            const { checkCreditLimit } = await import('@/services/credit-service');
            const creditCheck = await checkCreditLimit(resolvedOwnerId, amountNumber);

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
                amount: amountNumber,
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
                date: createTransactionDate(dateStr),
                truckId,
                licensePlate: licensePlate?.toUpperCase() || null,
                ownerId: resolvedOwnerId,
                ownerName: ownerName || null,
                paymentType: paymentType as PaymentType,
                nozzleNumber: nozzleNumber ?? 0,
                liters: effectiveLiters,
                pricePerLiter: effectivePricePerLiter,
                amount: amountNumber,
                productType: productType || (paymentType === 'EXPENSE' ? 'EXPENSE' : 'LPG'),
                recordedById: auth.user.id,
                notes: notes || null,
                shiftId: effectiveShiftId,  // NEW: link to shift
            }
        });

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('[Gas Transaction POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
