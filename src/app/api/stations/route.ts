import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const stations = await prisma.station.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                type: true,
            }
        });

        return NextResponse.json(stations);
    } catch (error) {
        console.error('Stations GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch stations' }, { status: 500 });
    }
}
