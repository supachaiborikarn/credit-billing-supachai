import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Station Performance data
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');

        const simpleStations = STATIONS.filter(s => s.type === 'SIMPLE');
        const stationIds = simpleStations.map(s => s.id);

        const todayStr = getTodayBangkok();
        const endOfDay = getEndOfDayBangkok(todayStr);

        const startDate = new Date(endOfDay);
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Get aggregated data per station
        const stationsData = await Promise.all(
            simpleStations.map(async (station) => {
                const [aggregate, byNozzle] = await Promise.all([
                    prisma.transaction.aggregate({
                        where: {
                            stationId: station.id,
                            date: { gte: startDate, lte: endOfDay },
                            isVoided: false,
                            deletedAt: null
                        },
                        _sum: { liters: true, amount: true },
                        _count: { id: true }
                    }),
                    prisma.transaction.groupBy({
                        by: ['nozzleNumber'],
                        where: {
                            stationId: station.id,
                            date: { gte: startDate, lte: endOfDay },
                            isVoided: false,
                            deletedAt: null,
                            nozzleNumber: { not: null }
                        },
                        _sum: { liters: true, amount: true },
                        _count: { id: true }
                    })
                ]);

                return {
                    id: station.id,
                    name: station.name,
                    totalLiters: Number(aggregate._sum.liters) || 0,
                    totalRevenue: Number(aggregate._sum.amount) || 0,
                    totalTransactions: aggregate._count.id || 0,
                    // TODO: Add margin and profit when cost available
                    margin: null,
                    profit: null,
                    byNozzle: byNozzle.map(n => ({
                        nozzle: n.nozzleNumber,
                        liters: Number(n._sum.liters) || 0,
                        revenue: Number(n._sum.amount) || 0,
                        count: n._count.id
                    }))
                };
            })
        );

        // Sort by revenue descending
        stationsData.sort((a, b) => b.totalRevenue - a.totalRevenue);

        return NextResponse.json({
            period: { days, startDate: startDate.toISOString(), endDate: endOfDay.toISOString() },
            stations: stationsData
        });
    } catch (error) {
        console.error('Error fetching stations:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
