import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const group = searchParams.get('group');

        // Build where clause
        const whereClause: any = {
            transactions: {
                some: {
                    paymentType: 'CREDIT',
                    invoiceId: null,
                }
            }
        };

        // Add group filter if provided
        if (group && group !== 'all') {
            whereClause.groupType = group;
        }

        // Get all owners with unpaid credit transactions (not in an invoice)
        const ownersWithPendingCredit = await prisma.owner.findMany({
            where: whereClause,
            include: {
                transactions: {
                    where: {
                        paymentType: 'CREDIT',
                        invoiceId: null,
                    },
                    select: {
                        amount: true,
                    }
                }
            }
        });

        // Calculate totals for each owner
        const result = ownersWithPendingCredit.map(owner => ({
            id: owner.id,
            name: owner.name,
            code: owner.code,
            phone: owner.phone,
            totalCredit: owner.transactions.reduce((sum, t) => sum + Number(t.amount), 0),
            transactionCount: owner.transactions.length,
        })).filter(o => o.totalCredit > 0).sort((a, b) => b.totalCredit - a.totalCredit);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Pending invoices error:', error);
        return NextResponse.json({ error: 'Failed to fetch pending' }, { status: 500 });
    }
}
