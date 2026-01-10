import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Executive Overview data for Simple Stations
export async function GET(request: NextRequest) {
    try {
        const simpleStations = STATIONS.filter(s => s.type === 'SIMPLE');
        const stationIds = simpleStations.map(s => s.id);

        // Date ranges
        const todayStr = getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(todayStr);
        const endOfDay = getEndOfDayBangkok(todayStr);

        // Month range
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        // 30 days ago for trend
        const thirtyDaysAgo = new Date(startOfDay);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // ========== KPI Cards ==========
        const [todayData, monthData] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: startOfDay, lte: endOfDay },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: monthStart },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            })
        ]);

        // ========== 30-Day Trend ==========
        const trendTransactions = await prisma.transaction.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: thirtyDaysAgo, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            select: { date: true, amount: true, liters: true }
        });

        // Group by date
        const salesByDate = new Map<string, { revenue: number; liters: number; count: number }>();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(startOfDay);
            d.setDate(d.getDate() - i);
            salesByDate.set(d.toISOString().split('T')[0], { revenue: 0, liters: 0, count: 0 });
        }

        trendTransactions.forEach(t => {
            const key = t.date.toISOString().split('T')[0];
            if (salesByDate.has(key)) {
                const existing = salesByDate.get(key)!;
                existing.revenue += Number(t.amount);
                existing.liters += Number(t.liters);
                existing.count += 1;
            }
        });

        const dailyTrend = Array.from(salesByDate.entries()).map(([date, data]) => ({
            date,
            revenue: data.revenue,
            liters: data.liters,
            count: data.count
        }));

        // ========== Per-Station Summary ==========
        const stationsSummary = await Promise.all(
            simpleStations.map(async (station) => {
                const data = await prisma.transaction.aggregate({
                    where: {
                        stationId: station.id,
                        date: { gte: startOfDay, lte: endOfDay },
                        isVoided: false,
                        deletedAt: null
                    },
                    _sum: { liters: true, amount: true },
                    _count: { id: true }
                });

                return {
                    id: station.id,
                    name: station.name,
                    todayLiters: Number(data._sum.liters) || 0,
                    todayRevenue: Number(data._sum.amount) || 0,
                    todayTransactions: data._count.id || 0
                };
            })
        );

        return NextResponse.json({
            kpi: {
                today: {
                    liters: Number(todayData._sum.liters) || 0,
                    revenue: Number(todayData._sum.amount) || 0,
                    transactions: todayData._count.id || 0
                },
                month: {
                    liters: Number(monthData._sum.liters) || 0,
                    revenue: Number(monthData._sum.amount) || 0,
                    transactions: monthData._count.id || 0
                },
                // TODO: Add margin and profit when cost_per_liter is available
                margin: null,
                profit: null
            },
            dailyTrend,
            stations: stationsSummary
        });
    } catch (error) {
        console.error('Error fetching overview:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
