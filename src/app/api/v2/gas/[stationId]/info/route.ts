import { NextRequest, NextResponse } from 'next/server';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';

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

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }

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

