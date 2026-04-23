import { NextRequest, NextResponse } from 'next/server';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

/**
 * GET /api/v2/gas/[stationId]/info
 * Get station information (GAS stations only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station } = auth;

        return NextResponse.json({
            station: {
                id: station.dbId,
                name: station.name,
                type: station.type,
                index: station.index
            }
        });
    } catch (error) {
        console.error('[Station Info]:', error);
        return NextResponse.json({ error: 'Failed to fetch station' }, { status: 500 });
    }
}
