import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

// GET - ดึงรายการ Owner
export async function GET(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const outstanding = searchParams.get('outstanding');

        const where: Record<string, unknown> = { deletedAt: null };

        if (outstanding === 'true') {
            where.currentCredit = { gt: 0 };
        }

        const owners = await prisma.owner.findMany({
            where,
            select: {
                id: true,
                name: true,
                phone: true,
                creditLimit: true,
                currentCredit: true,
                groupType: true,
                _count: { select: { transactions: true, trucks: true } }
            },
            orderBy: outstanding ? { currentCredit: 'desc' } : { name: 'asc' }
        });

        return NextResponse.json({
            owners: owners.map(o => ({
                ...o,
                creditLimit: Number(o.creditLimit),
                currentCredit: Number(o.currentCredit),
                transactionCount: o._count.transactions,
                truckCount: o._count.trucks
            }))
        });
    } catch (error) {
        console.error('Owners API error:', error);
        return NextResponse.json({ error: 'Failed to fetch owners' }, { status: 500 });
    }
}
