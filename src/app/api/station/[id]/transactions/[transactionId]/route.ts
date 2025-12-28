import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { checkShiftModifiable } from '@/services/shift-service';

// GET single transaction
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { transactionId } = await params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                owner: { select: { name: true, code: true } },
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json(transaction);
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
        const { transactionId } = await params;
        const body = await request.json();

        // Get user from session with role
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        let userId = 'system';
        let userRole = 'STAFF';
        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { user: { select: { id: true, role: true } } }
            });
            if (session) {
                userId = session.userId;
                userRole = session.user.role;
            }
        }

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

        // Update transaction
        const transaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                licensePlate,
                ownerName,
                ownerId,
                paymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                billBookNo,
                billNo,
                transferProofUrl,
            }
        });

        // Log audit with old and new data
        await prisma.auditLog.create({
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
        const { transactionId } = await params;

        // Get reason from query string or body
        const url = new URL(request.url);
        let reason = url.searchParams.get('reason') || 'ไม่ระบุเหตุผล';

        try {
            const body = await request.json();
            if (body.reason) reason = body.reason;
        } catch {
            // No body, use query param
        }

        // Get user from session with role
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        let userId = 'system';
        let userRole = 'STAFF';
        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { user: { select: { id: true, role: true } } }
            });
            if (session) {
                userId = session.userId;
                userRole = session.user.role;
            }
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

        // Soft delete: set isVoided = true, deletedAt = now()
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                isVoided: true,
                voidedAt: new Date(),
                voidedById: userId,
                voidReason: reason,
                deletedAt: new Date(),
            }
        });

        // Log audit
        await prisma.auditLog.create({
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

        return NextResponse.json({ success: true, message: 'รายการถูกยกเลิกเรียบร้อย' });
    } catch (error) {
        console.error('Transaction DELETE error:', error);
        return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 });
    }
}
