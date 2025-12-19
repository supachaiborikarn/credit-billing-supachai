import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';

        if (query.length < 2) {
            return NextResponse.json([]);
        }

        const trucks = await prisma.truck.findMany({
            where: {
                licensePlate: { contains: query, mode: 'insensitive' }
            },
            take: 10,
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        phone: true,
                        groupType: true,
                    }
                }
            }
        });

        return NextResponse.json(trucks.map(t => ({
            id: t.id,
            licensePlate: t.licensePlate,
            ownerId: t.owner.id,
            ownerName: t.owner.name,
            ownerCode: t.code || t.owner.code, // ใช้ truck.code ก่อน fallback เป็น owner.code
            ownerPhone: t.owner.phone,
            ownerGroup: t.owner.groupType,
        })));
    } catch (error) {
        console.error('Truck search error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
