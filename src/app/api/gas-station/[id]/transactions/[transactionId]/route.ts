import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { cookies } from 'next/headers';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { id, transactionId } = await params;
        const stationId = `station-${id}`;

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

        // Find the transaction with dailyRecord and shifts for Anti-Fraud check
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                stationId: stationId,
                deletedAt: null,
            },
            include: {
                dailyRecord: {
                    include: {
                        shifts: { where: { status: { not: 'OPEN' } } }
                    }
                }
            }
        });

        if (!transaction) {
            return HttpErrors.notFound('ไม่พบรายการ');
        }

        // Anti-Fraud: Check if locked (Admin can bypass)
        if (userRole !== 'ADMIN') {
            const closedShifts = transaction.dailyRecord?.shifts || [];
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

        // Soft delete the transaction
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                deletedAt: new Date(),
                isVoided: true,
                voidedAt: new Date(),
                voidedById: userId,
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId,
                action: 'DELETE',
                model: 'Transaction',
                recordId: transactionId,
                oldData: {
                    licensePlate: transaction.licensePlate,
                    amount: Number(transaction.amount),
                },
                newData: { isVoided: true },
            }
        });

        return NextResponse.json({ success: true, message: 'ลบรายการเรียบร้อย' });
    } catch (error) {
        console.error('[Gas Station Transaction DELETE]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
