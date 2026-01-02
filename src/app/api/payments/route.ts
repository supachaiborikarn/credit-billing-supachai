import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateOwnerCredit } from '@/services/credit-service';

// POST - บันทึกการชำระเงิน
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { invoiceId, amount, paymentMethod, note } = body;

        if (!invoiceId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'กรุณาระบุ invoiceId และจำนวนเงิน' }, { status: 400 });
        }

        // Get invoice with owner
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                ownerId: true,
                totalAmount: true,
                paidAmount: true,
                status: true
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'ไม่พบ Invoice' }, { status: 404 });
        }

        const remainingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
        if (amount > remainingAmount) {
            return NextResponse.json({
                error: `จำนวนเกินยอดคงค้าง (เหลือ ${remainingAmount.toLocaleString()} บาท)`
            }, { status: 400 });
        }

        // Create payment record
        const payment = await prisma.payment.create({
            data: {
                invoiceId,
                amount,
                paymentMethod: paymentMethod || 'CASH',
                notes: note || null
            }
        });

        // Update invoice paid amount and status
        const newPaidAmount = Number(invoice.paidAmount) + amount;
        const newStatus = newPaidAmount >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIAL';

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                paidAmount: newPaidAmount,
                status: newStatus
            }
        });

        // Update owner's current credit (reduce debt)
        const creditResult = await updateOwnerCredit(invoice.ownerId, -amount);

        return NextResponse.json({
            success: true,
            payment: {
                id: payment.id,
                amount,
                invoiceId
            },
            invoice: {
                newPaidAmount,
                newStatus,
                remainingBalance: Number(invoice.totalAmount) - newPaidAmount
            },
            credit: creditResult
        });
    } catch (error) {
        console.error('Payment API error:', error);
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }
}

// GET - ดึงรายการ payments
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get('invoiceId');

        const where: Record<string, unknown> = {};
        if (invoiceId) where.invoiceId = invoiceId;

        const payments = await prisma.payment.findMany({
            where,
            include: {
                invoice: {
                    select: {
                        invoiceNumber: true,
                        owner: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json({ payments });
    } catch (error) {
        console.error('Payments GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}
