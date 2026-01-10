import { NextRequest, NextResponse } from 'next/server';
import { STATIONS, FUEL_TYPES } from '@/constants';

// GET: Stock Dashboard (Mock - TODO: implement when Tank model is available)
export async function GET(request: NextRequest) {
    try {
        // Simple stations only
        const simpleStations = STATIONS.filter(s => s.type === 'SIMPLE');

        // Mock tank data - TODO: Replace with real data when Tank model is created
        const mockTanks = simpleStations.flatMap(station =>
            FUEL_TYPES.filter(f => !('isProduct' in f && f.isProduct)).slice(0, 3).map((fuel) => ({
                id: `mock-${station.id}-${fuel.value}`,
                stationId: station.id,
                stationName: station.name,
                fuelType: fuel.value,
                fuelLabel: fuel.label,
                capacity: 20000,
                currentVolume: Math.floor(Math.random() * 15000) + 5000,
                lastRefillDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                avgDailyUsage: 800 + Math.floor(Math.random() * 400),
                estimatedDaysToEmpty: 0,
                status: 'OK' as 'OK' | 'ORDER_SOON' | 'ORDER_NOW'
            }))
        );

        mockTanks.forEach(tank => {
            tank.estimatedDaysToEmpty = tank.avgDailyUsage > 0
                ? Math.floor(tank.currentVolume / tank.avgDailyUsage)
                : 999;

            if (tank.estimatedDaysToEmpty <= 2) {
                tank.status = 'ORDER_NOW';
            } else if (tank.estimatedDaysToEmpty <= 5) {
                tank.status = 'ORDER_SOON';
            } else {
                tank.status = 'OK';
            }
        });

        mockTanks.sort((a, b) => a.estimatedDaysToEmpty - b.estimatedDaysToEmpty);

        const urgentCount = mockTanks.filter(t => t.status === 'ORDER_NOW').length;
        const soonCount = mockTanks.filter(t => t.status === 'ORDER_SOON').length;

        return NextResponse.json({
            _notice: 'This is mock data. TODO: Implement real Tank model and data.',
            summary: {
                totalTanks: mockTanks.length,
                orderNow: urgentCount,
                orderSoon: soonCount,
                ok: mockTanks.length - urgentCount - soonCount
            },
            tanks: mockTanks
        });
    } catch (error) {
        console.error('Error fetching stock:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
