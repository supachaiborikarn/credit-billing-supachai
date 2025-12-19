import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q') || '';

        if (query.length < 2) {
            return NextResponse.json([]);
        }

        const owners = await prisma.owner.findMany({
            where: {
                deletedAt: null,
                name: {
                    contains: query,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                name: true,
                code: true,
                phone: true,
            },
            take: 10,
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(owners);
    } catch (error) {
        console.error('Owner search error:', error);
        return NextResponse.json({ error: 'Failed to search owners' }, { status: 500 });
    }
}
