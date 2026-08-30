import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                owner: {
                    select: { id: true, name: true, code: true, phone: true }
                },
                transactions: {
                    orderBy: { date: 'asc' },
                    select: {
                        id: true,
                        date: true,
                        licensePlate: true,
                        liters: true,
                        pricePerLiter: true,
                        amount: true,
                        paymentType: true,
                        transferProofUrl: true,
                    }
                },
                payments: {
                    orderBy: { paymentDate: 'desc' },
                }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json(invoice);
    } catch (error) {
        console.error('Invoice GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
    }
}

// DELETE invoice - unlink all transactions and delete invoice atomically
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { id } = await params;

        const result = await prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id },
                include: {
                    transactions: { select: { id: true } },
                    payments: { select: { id: true } },
                },
            });
            if (!invoice) return { state: 'NOT_FOUND' as const };
            if (invoice.payments.length > 0) return { state: 'HAS_PAYMENTS' as const };

            await tx.transaction.updateMany({
                where: { invoiceId: id },
                data: { invoiceId: null },
            });
            await tx.invoice.delete({ where: { id } });
            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'DELETE',
                    model: 'Invoice',
                    recordId: id,
                    oldData: {
                        invoiceNumber: invoice.invoiceNumber,
                        ownerId: invoice.ownerId,
                        totalAmount: Number(invoice.totalAmount),
                        transactionCount: invoice.transactions.length,
                    },
                },
            });
            return { state: 'DELETED' as const, transactionCount: invoice.transactions.length };
        }, {
            maxWait: 5000,
            timeout: 20000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        if (result.state === 'NOT_FOUND') {
            return NextResponse.json({ error: 'ไม่พบใบวางบิล' }, { status: 404 });
        }
        if (result.state === 'HAS_PAYMENTS') {
            return NextResponse.json({ error: 'ใบวางบิลนี้มีการชำระเงินแล้ว ไม่สามารถลบได้' }, { status: 400 });
        }
        return NextResponse.json({
            success: true,
            message: 'ลบใบวางบิลสำเร็จ รายการทั้งหมดกลับไปสถานะรอวางบิล',
            transactionsUnlinked: result.transactionCount,
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
            return NextResponse.json({ error: 'ข้อมูล Invoice เปลี่ยนพร้อมกัน กรุณารีเฟรชแล้วลองใหม่' }, { status: 409 });
        }
        console.error('Invoice DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }
}
