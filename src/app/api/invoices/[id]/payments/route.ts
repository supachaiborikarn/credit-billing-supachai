import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { amount, paymentMethod, notes } = body;

        // Get invoice
        const invoice = await prisma.invoice.findUnique({
            where: { id },
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Create payment
        const payment = await prisma.payment.create({
            data: {
                invoice: { connect: { id } },
                amount,
                paymentMethod,
                paymentDate: new Date(),
                notes,
            }
        });

        // Update invoice paid amount and status
        const newPaidAmount = Number(invoice.paidAmount) + amount;
        const totalAmount = Number(invoice.totalAmount);
        let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';

        if (newPaidAmount >= totalAmount) {
            newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
            newStatus = 'PARTIAL';
        }

        await prisma.invoice.update({
            where: { id },
            data: {
                paidAmount: newPaidAmount,
                status: newStatus,
            }
        });

        return NextResponse.json(payment);
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
