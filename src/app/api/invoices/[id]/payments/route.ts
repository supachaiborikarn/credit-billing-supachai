import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

const PAYMENT_TOLERANCE = 0.01;
const PAYMENT_CONFLICT = 'INVOICE_PAYMENT_CONFLICT';

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

        const invoice = await prisma.invoice.findUnique({
            where: { id },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const paidAmount = Number(invoice.paidAmount);
        const totalAmount = Number(invoice.totalAmount);
        const remainingAmount = totalAmount - paidAmount;
        if (paymentAmount > remainingAmount + PAYMENT_TOLERANCE) {
            return NextResponse.json({
                error: `จำนวนเงินเกินยอดคงค้าง (เหลือ ${remainingAmount.toLocaleString()} บาท)`,
            }, { status: 400 });
        }

        const newPaidAmount = paidAmount + paymentAmount;
        let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
        if (newPaidAmount >= totalAmount) {
            newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
            newStatus = 'PARTIAL';
        }

        const payment = await prisma.$transaction(async (tx) => {
            // Optimistic concurrency guard: two payment requests that read the same
            // paidAmount cannot both update the invoice successfully.
            const updated = await tx.invoice.updateMany({
                where: {
                    id,
                    paidAmount: invoice.paidAmount,
                },
                data: {
                    paidAmount: newPaidAmount,
                    status: newStatus,
                },
            });

            if (updated.count !== 1) {
                throw new Error(PAYMENT_CONFLICT);
            }

            return tx.payment.create({
                data: {
                    invoice: { connect: { id } },
                    amount: paymentAmount,
                    paymentMethod: paymentMethod || 'TRANSFER',
                    paymentDate: new Date(),
                    notes: notes || null,
                },
            });
        });

        return NextResponse.json({
            ...payment,
            invoice: {
                paidAmount: newPaidAmount,
                status: newStatus,
                remainingBalance: Math.max(0, totalAmount - newPaidAmount),
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === PAYMENT_CONFLICT) {
            return NextResponse.json(
                { error: 'ยอด Invoice เปลี่ยนระหว่างรับชำระ กรุณาโหลดข้อมูลใหม่ก่อนบันทึกอีกครั้ง' },
                { status: 409 }
            );
        }
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
