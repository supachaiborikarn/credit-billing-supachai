import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE multiple invoices at once
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoiceIds } = body as { invoiceIds: string[] };

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json({ error: 'ต้องระบุรายการใบวางบิลที่ต้องการลบ' }, { status: 400 });
        }

        // Check all invoices exist and have no payments
        const invoices = await prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            include: {
                transactions: { select: { id: true } },
                payments: { select: { id: true } }
            }
        });

        // Check if any invoice has payments
        const invoicesWithPayments = invoices.filter(inv => inv.payments.length > 0);
        if (invoicesWithPayments.length > 0) {
            return NextResponse.json({
                error: `มี ${invoicesWithPayments.length} ใบที่มีการชำระเงินแล้ว ไม่สามารถลบได้`,
                invoicesWithPayments: invoicesWithPayments.map(inv => inv.invoiceNumber)
            }, { status: 400 });
        }

        // Process each invoice
        let totalUnlinked = 0;
        const deletedInvoices: string[] = [];
        const errors: string[] = [];

        for (const invoice of invoices) {
            try {
                // Unlink all transactions
                await prisma.transaction.updateMany({
                    where: { invoiceId: invoice.id },
                    data: { invoiceId: null }
                });

                totalUnlinked += invoice.transactions.length;

                // Delete the invoice
                await prisma.invoice.delete({
                    where: { id: invoice.id }
                });

                deletedInvoices.push(invoice.invoiceNumber);
            } catch (err: any) {
                errors.push(`${invoice.invoiceNumber}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `ลบใบวางบิลสำเร็จ ${deletedInvoices.length} ใบ`,
            deletedCount: deletedInvoices.length,
            deletedInvoices,
            transactionsUnlinked: totalUnlinked,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Invoice bulk delete error:', error);
        return NextResponse.json({ error: 'Failed to delete invoices' }, { status: 500 });
    }
}
