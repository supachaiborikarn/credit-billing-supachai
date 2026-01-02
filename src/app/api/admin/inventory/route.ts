import { NextResponse, NextRequest } from 'next/server';
import { getStationInventorySummary } from '@/services/inventory-service';

// GET - ดึงสรุป Inventory ของสถานี
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');

        if (!stationId) {
            return NextResponse.json({ error: 'กรุณาระบุ stationId' }, { status: 400 });
        }

        const items = await getStationInventorySummary(stationId);

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Inventory API error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}
