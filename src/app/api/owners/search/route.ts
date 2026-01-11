import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q') || '';

        if (query.length < 2) {
            return NextResponse.json({ owners: [] });
        }

        // Search by owner name, code, OR truck license plate
        const owners = await prisma.owner.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
                    {
                        trucks: {
                            some: {
                                licensePlate: { contains: query, mode: 'insensitive' },
                                deletedAt: null
                            }
                        }
                    }
                ]
            },
            select: {
                id: true,
                name: true,
                code: true,
                phone: true,
                trucks: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        licensePlate: true
                    },
                    orderBy: { licensePlate: 'asc' }
                }
            },
            take: 20,
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ owners });
    } catch (error) {
        console.error('Owner search error:', error);
        return NextResponse.json({ error: 'Failed to search owners' }, { status: 500 });
    }
}
