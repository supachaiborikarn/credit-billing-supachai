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
