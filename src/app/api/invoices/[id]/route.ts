import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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

// DELETE invoice - unlink all transactions and delete invoice
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if invoice exists
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                transactions: { select: { id: true } },
                payments: { select: { id: true } }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'ไม่พบใบวางบิล' }, { status: 404 });
        }

        // Check if invoice has payments - warn user
        if (invoice.payments.length > 0) {
            return NextResponse.json({
                error: 'ใบวางบิลนี้มีการชำระเงินแล้ว ไม่สามารถลบได้'
            }, { status: 400 });
        }

        // Unlink all transactions (set invoiceId to null)
        await prisma.transaction.updateMany({
            where: { invoiceId: id },
            data: { invoiceId: null }
        });

        // Delete the invoice
        await prisma.invoice.delete({
            where: { id }
        });

        return NextResponse.json({
            success: true,
            message: 'ลบใบวางบิลสำเร็จ รายการทั้งหมดกลับไปสถานะรอวางบิล',
            transactionsUnlinked: invoice.transactions.length
        });
    } catch (error) {
        console.error('Invoice DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }
}
