import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Invoice, Owner, Prisma } from '@prisma/client';

type InvoiceWithRelations = Invoice & {
    owner: Pick<Owner, 'id' | 'name' | 'code'>;
    _count: { transactions: number };
};

export async function GET() {
    try {
        const invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                },
                _count: { select: { transactions: true } }
            }
        });

        return NextResponse.json(invoices);
    } catch (error) {
        console.error('Invoices GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ownerId, ownerIds, startDate, endDate, combineOwners } = body;

        // Support both single ownerId and multiple ownerIds
        const targetOwnerIds = ownerIds || (ownerId ? [ownerId] : []);

        if (targetOwnerIds.length === 0) {
            return NextResponse.json({ error: 'ต้องระบุเจ้าของอย่างน้อย 1 ราย' }, { status: 400 });
        }

        // Build date filter if provided (using Bangkok timezone)
        const dateFilter: { gte?: Date; lte?: Date } = {};
        if (startDate) {
            // Parse as Bangkok time start of day (00:00:00 +07:00)
            dateFilter.gte = new Date(`${startDate}T00:00:00+07:00`);
        }
        if (endDate) {
            // Parse as Bangkok time end of day (23:59:59 +07:00)
            dateFilter.lte = new Date(`${endDate}T23:59:59.999+07:00`);
        }

        const createdInvoices: InvoiceWithRelations[] = [];

        if (combineOwners && targetOwnerIds.length > 1) {
            // Combine all owners into one invoice (use first owner as main)
            const transactions = await prisma.transaction.findMany({
                where: {
                    ownerId: { in: targetOwnerIds },
                    paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                    invoiceId: null,
                    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
                },
            });

            if (transactions.length === 0) {
                return NextResponse.json({ error: 'ไม่มีรายการที่รอวางบิล' }, { status: 400 });
            }

            const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

            // Generate invoice number
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
            const existingCount = await prisma.invoice.count({
                where: { createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } }
            });
            const invoiceNumber = `INV-${dateStr}-${String(existingCount + 1).padStart(3, '0')}`;

            const invoice = await prisma.invoice.create({
                data: {
                    invoiceNumber,
                    owner: { connect: { id: targetOwnerIds[0] } },
                    totalAmount,
                    paidAmount: 0,
                    status: 'PENDING',
                    notes: `รวมจากเจ้าของ ${targetOwnerIds.length} ราย`,
                    transactions: { connect: transactions.map(t => ({ id: t.id })) }
                },
                include: {
                    owner: { select: { id: true, name: true, code: true } },
                    _count: { select: { transactions: true } }
                }
            });

            createdInvoices.push(invoice);
        } else {
            // Create separate invoice for each owner
            for (const owId of targetOwnerIds) {
                const transactions = await prisma.transaction.findMany({
                    where: {
                        ownerId: owId,
                        paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                        invoiceId: null,
                        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
                    },
                });

                if (transactions.length === 0) continue;

                const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

                const today = new Date();
                const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
                const existingCount = await prisma.invoice.count({
                    where: { createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } }
                });
                const invoiceNumber = `INV-${dateStr}-${String(existingCount + createdInvoices.length + 1).padStart(3, '0')}`;

                const invoice = await prisma.invoice.create({
                    data: {
                        invoiceNumber,
                        owner: { connect: { id: owId } },
                        totalAmount,
                        paidAmount: 0,
                        status: 'PENDING',
                        transactions: { connect: transactions.map(t => ({ id: t.id })) }
                    },
                    include: {
                        owner: { select: { id: true, name: true, code: true } },
                        _count: { select: { transactions: true } }
                    }
                });

                createdInvoices.push(invoice);
            }
        }

        if (createdInvoices.length === 0) {
            return NextResponse.json({ error: 'ไม่มีรายการที่รอวางบิล' }, { status: 400 });
        }

        // Return single invoice or array
        if (createdInvoices.length === 1) {
            return NextResponse.json(createdInvoices[0]);
        }
        return NextResponse.json({ invoices: createdInvoices, count: createdInvoices.length });
    } catch (error: unknown) {
        console.error('Invoice POST error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: 'Failed to create invoice',
            details: errorMessage
        }, { status: 500 });
    }
}
