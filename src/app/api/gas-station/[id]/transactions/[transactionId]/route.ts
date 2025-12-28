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

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        let userId = 'system';
        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { userId: true }
            });
            if (session) userId = session.userId;
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
                        shifts: { where: { status: 'LOCKED' } }
                    }
                }
            }
        });

        if (!transaction) {
            return HttpErrors.notFound('ไม่พบรายการ');
        }

        // Anti-Fraud: Check if any shift is locked
        const lockedShifts = transaction.dailyRecord?.shifts || [];
        if (lockedShifts.length > 0) {
            return NextResponse.json(
                { error: '🔒 ไม่สามารถลบได้ กะนี้ถูกล็อกแล้ว' },
                { status: 403 }
            );
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
