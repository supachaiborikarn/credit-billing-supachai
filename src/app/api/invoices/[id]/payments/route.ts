import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { amount, paymentMethod, notes } = body;
        const paymentAmount = Number(amount);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return NextResponse.json({ error: 'จำนวนเงินต้องมากกว่า 0' }, { status: 400 });
        }

        // Get invoice
        const invoice = await prisma.invoice.findUnique({
            where: { id },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const remainingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        if (paymentAmount > remainingAmount + 0.01) {
            return NextResponse.json({
                error: `จำนวนเงินเกินยอดคงค้าง (เหลือ ${remainingAmount.toLocaleString()} บาท)`,
            }, { status: 400 });
        }

        // Create payment and update invoice together to avoid partial writes.
        const newPaidAmount = Number(invoice.paidAmount) + paymentAmount;
        const totalAmount = Number(invoice.totalAmount);
        let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';

        if (newPaidAmount >= totalAmount) {
            newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
            newStatus = 'PARTIAL';
        }

        const payment = await prisma.$transaction(async (tx) => {
            const createdPayment = await tx.payment.create({
                data: {
                    invoice: { connect: { id } },
                    amount: paymentAmount,
                    paymentMethod: paymentMethod || 'TRANSFER',
                    paymentDate: new Date(),
                    notes: notes || null,
                }
            });

            await tx.invoice.update({
                where: { id },
                data: {
                    paidAmount: newPaidAmount,
                    status: newStatus,
                }
            });

            return createdPayment;
        });

        return NextResponse.json({
            ...payment,
            invoice: {
                paidAmount: newPaidAmount,
                status: newStatus,
                remainingBalance: Math.max(0, totalAmount - newPaidAmount),
            }
        });
    } catch (error) {
        console.error('Payment POST error:', error);
        return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;

        const payments = await prisma.payment.findMany({
            where: { invoiceId: id },
            orderBy: { paymentDate: 'desc' },
        });

        return NextResponse.json(payments);
    } catch (error) {
        console.error('Payments GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}
