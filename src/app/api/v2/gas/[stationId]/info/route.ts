import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v2/gas/[stationId]/info
 * Get station information
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: {
                id: true,
                name: true,
                type: true
            }
        });

        if (!station) {
            return NextResponse.json({ error: 'Station not found' }, { status: 404 });
        }

        return NextResponse.json({ station });
    } catch (error) {
        console.error('[Station Info]:', error);
        return NextResponse.json({ error: 'Failed to fetch station' }, { status: 500 });
    }
}
