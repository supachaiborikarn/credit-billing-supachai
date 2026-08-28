import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/api-auth';
import { canAccessStation } from '@/lib/auth-utils';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { canMutateHistoricalStationData, isStationRouteBoundToTransaction } from '@/lib/stations/station-context';

const creditPaymentTypeSet = new Set<string>(CREDIT_PAYMENT_TYPES);

// GET single transaction
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { id, transactionId } = await params;
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                owner: { select: { name: true, code: true } },
                recordedBy: { select: { name: true } },
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (!isStationRouteBoundToTransaction(id, transaction.stationId)) {
            return NextResponse.json({ error: 'Transaction not found for this station' }, { status: 404 });
        }

        if (!canAccessStation(auth.user, transaction.stationId)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงรายการนี้' }, { status: 403 });
        }

        return NextResponse.json({
            ...transaction,
            fuelType: transaction.productType || null,
            createdAt: transaction.createdAt?.toISOString?.() || transaction.date.toISOString(),
            date: transaction.date.toISOString(),
            bookNo: transaction.billBookNo || '',
            billBookNo: transaction.billBookNo || '',
            recordedByName: transaction.recordedBy?.name || '-',
        });
    } catch (error) {
        console.error('Transaction GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
    }
}

// UPDATE transaction with AuditLog
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { id, transactionId } = await params;
        const body = await request.json();
        const auth = await requireApiSession();
        if (auth.response) return auth.response;
        const userId = auth.user.id;
        const userRole = auth.user.role;

        const {
            licensePlate,
            ownerName,
            ownerId,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            billBookNo,
            bookNo,
            billNo,
            transferProofUrl,
        } = body;

        // Get old data for audit log
        const oldTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                dailyRecord: {
                    include: {
                        shifts: { where: { status: { not: 'OPEN' } } }
                    }
                }
            }
        });

        if (!oldTransaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (!isStationRouteBoundToTransaction(id, oldTransaction.stationId)) {
            return NextResponse.json({ error: 'Transaction not found for this station' }, { status: 404 });
        }

        if (!canAccessStation(auth.user, oldTransaction.stationId)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขรายการนี้' }, { status: 403 });
        }

        if (!canMutateHistoricalStationData(auth.user, oldTransaction.stationId)) {
            return NextResponse.json(
                { error: 'สถานีนี้ย้ายงานหน้าปั๊มไป POS แล้ว การแก้ไขรายการย้อนหลังทำได้เฉพาะแอดมิน' },
                { status: 403 }
            );
        }

        // Anti-Fraud: Check if locked (Admin can bypass)
        if (userRole !== 'ADMIN') {
            const closedShifts = oldTransaction.dailyRecord?.shifts || [];
            if (closedShifts.length > 0) {
                // Check for explicitly locked shifts
                const lockedShift = closedShifts.find(s => s.status === 'LOCKED');
                if (lockedShift) {
                    return NextResponse.json(
                        { error: '🔒 ไม่สามารถแก้ไขได้ กะนี้ถูกล็อกแล้ว' },
                        { status: 403 }
                    );
                }

                // Auto-lock: Check if closed more than 24 hours ago
                const closedShift = closedShifts.find(s => s.status === 'CLOSED' && s.closedAt);
                if (closedShift && closedShift.closedAt) {
                    const hoursSinceClosed = (Date.now() - new Date(closedShift.closedAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceClosed > 24) {
                        return NextResponse.json(
                            { error: '🔒 ไม่สามารถแก้ไขได้ กะปิดเกิน 24 ชั่วโมงแล้ว' },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        const nextPaymentType = paymentType ?? oldTransaction.paymentType;
        const nextOwnerName = typeof ownerName === 'string' ? ownerName.trim() : oldTransaction.ownerName;
        const nextOwnerId = ownerId ?? oldTransaction.ownerId;
        const nextTransferProofUrl = typeof transferProofUrl === 'string'
            ? transferProofUrl.trim()
            : oldTransaction.transferProofUrl;

        if (nextPaymentType === 'TRANSFER' && !nextTransferProofUrl) {
            return NextResponse.json(
                { error: 'รายการโอนเงินต้องแนบรูปหลักฐานการโอน' },
                { status: 400 }
            );
        }

        if (creditPaymentTypeSet.has(nextPaymentType) && !nextOwnerName && !nextOwnerId) {
            return NextResponse.json(
                { error: 'รายการเงินเชื่อต้องระบุชื่อลูกค้า' },
                { status: 400 }
            );
        }

        const transaction = await prisma.$transaction(async (tx) => {
            const updated = await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    licensePlate,
                    ownerName: nextOwnerName || null,
                    ownerId,
                    paymentType,
                    nozzleNumber,
                    liters,
                    pricePerLiter,
                    amount,
                    billBookNo: billBookNo ?? bookNo,
                    billNo,
                    transferProofUrl: nextTransferProofUrl || null,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'UPDATE',
                    model: 'Transaction',
                    recordId: transactionId,
                    oldData: {
                        licensePlate: oldTransaction.licensePlate,
                        ownerName: oldTransaction.ownerName,
                        paymentType: oldTransaction.paymentType,
                        liters: Number(oldTransaction.liters),
                        amount: Number(oldTransaction.amount),
                    },
                    newData: {
                        licensePlate,
                        ownerName,
                        paymentType,
                        liters: Number(liters),
                        amount: Number(amount),
                    },
                }
            });

            return updated;
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('Transaction PUT error:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}

// VOID transaction (soft delete with reason)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { id, transactionId } = await params;
        const auth = await requireApiSession();
        if (auth.response) return auth.response;
        const userId = auth.user.id;
        const userRole = auth.user.role;

        // Get reason from query string or body
        const url = new URL(request.url);
        let reason = url.searchParams.get('reason') || 'ไม่ระบุเหตุผล';

        try {
            const body = await request.json();
            if (body.reason) reason = body.reason;
        } catch {
            // No body, use query param
        }

        // Get old data for audit log
        const oldTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                dailyRecord: {
                    include: {
                        shifts: { where: { status: { not: 'OPEN' } } }
                    }
                }
            }
        });

        if (!oldTransaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (!isStationRouteBoundToTransaction(id, oldTransaction.stationId)) {
            return NextResponse.json({ error: 'Transaction not found for this station' }, { status: 404 });
        }

        if (!canAccessStation(auth.user, oldTransaction.stationId)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ยกเลิกรายการนี้' }, { status: 403 });
        }

        if (!canMutateHistoricalStationData(auth.user, oldTransaction.stationId)) {
            return NextResponse.json(
                { error: 'สถานีนี้ย้ายงานหน้าปั๊มไป POS แล้ว การยกเลิกรายการย้อนหลังทำได้เฉพาะแอดมิน' },
                { status: 403 }
            );
        }

        // Anti-Fraud: Check if locked (Admin can bypass)
        if (userRole !== 'ADMIN') {
            const closedShifts = oldTransaction.dailyRecord?.shifts || [];
            if (closedShifts.length > 0) {
                const lockedShift = closedShifts.find(s => s.status === 'LOCKED');
                if (lockedShift) {
                    return NextResponse.json(
                        { error: '🔒 ไม่สามารถลบได้ กะนี้ถูกล็อกแล้ว' },
                        { status: 403 }
                    );
                }

                // Auto-lock: Check if closed more than 24 hours ago
                const closedShift = closedShifts.find(s => s.status === 'CLOSED' && s.closedAt);
                if (closedShift && closedShift.closedAt) {
                    const hoursSinceClosed = (Date.now() - new Date(closedShift.closedAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceClosed > 24) {
                        return NextResponse.json(
                            { error: '🔒 ไม่สามารถลบได้ กะปิดเกิน 24 ชั่วโมงแล้ว' },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            const now = new Date();

            await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    isVoided: true,
                    voidedAt: now,
                    voidedById: userId,
                    voidReason: reason,
                    deletedAt: now,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'DELETE',
                    model: 'Transaction',
                    recordId: transactionId,
                    oldData: {
                        licensePlate: oldTransaction.licensePlate,
                        ownerName: oldTransaction.ownerName,
                        amount: Number(oldTransaction.amount),
                    },
                    newData: {
                        isVoided: true,
                        voidReason: reason,
                    },
                }
            });
        });

        return NextResponse.json({ success: true, message: 'รายการถูกยกเลิกเรียบร้อย' });
    } catch (error) {
        console.error('Transaction DELETE error:', error);
        return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 });
    }
}
