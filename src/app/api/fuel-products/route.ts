import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

export async function GET() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const products = await prisma.fuelProduct.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true },
        });

        return NextResponse.json({ products });
    } catch (error) {
        console.error('Get fuel products error:', error);
        return NextResponse.json({ error: 'Failed to fetch fuel products' }, { status: 500 });
    }
}
