import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireApiSession } from '@/lib/api-auth';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const group = searchParams.get('group');
        const pendingPaymentTypes = [...CREDIT_PAYMENT_TYPES];

        // Build where clause - include all credit-like payment types for invoicing
        const whereClause: Prisma.OwnerWhereInput = {
            transactions: {
                some: {
                    paymentType: { in: pendingPaymentTypes },
                    invoiceId: null,
                    deletedAt: null,
                    isVoided: false,
                }
            }
        };

        // Add group filter if provided
        if (group && group !== 'all') {
            whereClause.groupType = group as Prisma.EnumOwnerGroupFilter;
        }

        // Get all owners with unpaid credit/box_truck transactions (not in an invoice)
        const ownersWithPendingCredit = await prisma.owner.findMany({
            where: whereClause,
            include: {
                transactions: {
                    where: {
                        paymentType: { in: pendingPaymentTypes },
                        invoiceId: null,
                        deletedAt: null,
                        isVoided: false,
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
