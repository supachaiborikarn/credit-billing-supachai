import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

/**
 * GET /api/v2/gas/admin/gauge
 * Get gauge readings history for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');
        const tankFilter = searchParams.get('tank');

        const fromDate = from ? new Date(from + 'T00:00:00+07:00') : new Date();
        const toDate = to ? new Date(to + 'T23:59:59+07:00') : new Date();

        // Get GAS station IDs
        const gasStationIds = STATIONS
            .filter(s => s.type === 'GAS')
            .map(s => s.id);

        const stationIds = stationIdFilter && stationIdFilter !== 'all'
            ? [stationIdFilter]
            : gasStationIds;

        // Build query
        const where: Record<string, unknown> = {
            stationId: { in: stationIds },
            date: {
                gte: fromDate,
                lte: toDate
            }
        };

        if (tankFilter && tankFilter !== 'all') {
            where.tankNumber = parseInt(tankFilter);
        }

        // Get gauge readings
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500
        });

        // Get station names
        const stationsMap: Record<string, string> = {};
        STATIONS.forEach(s => {
            stationsMap[s.id] = s.name;
        });

        const readings = gaugeReadings.map(g => ({
            id: g.id,
            date: g.date.toISOString().split('T')[0],
            displayDate: g.date.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            stationId: g.stationId,
            stationName: stationsMap[g.stationId] || 'Unknown',
            shiftNumber: g.shiftNumber,
            tankNumber: g.tankNumber,
            percentage: Number(g.percentage),
            notes: g.notes,
            createdAt: g.createdAt.toISOString()
        }));

        return NextResponse.json({ readings });
    } catch (error) {
        console.error('[Gauge History]:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}
