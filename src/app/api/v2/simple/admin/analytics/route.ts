import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Advanced Analytics for Simple/FULL stations
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const stationType = searchParams.get('type') || 'SIMPLE'; // SIMPLE or FULL

        // Get stations based on type
        let stations = STATIONS.filter(s => s.type === stationType);
        if (stationId) {
            stations = stations.filter(s => s.id === stationId);
        }
        const stationIds = stations.map(s => s.id);

        if (stationIds.length === 0) {
            return NextResponse.json({ error: 'No stations found' }, { status: 404 });
        }

        const todayStr = getTodayBangkok();
        const today = getStartOfDayBangkok(todayStr);

        // Date ranges
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        // 30 days for heatmap
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // ========== 1. Week Comparison ==========
        const [thisWeekData, lastWeekData] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: thisWeekStart },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: lastWeekStart, lte: lastWeekEnd },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            })
        ]);

        const weekComparison = {
            thisWeek: {
                liters: Number(thisWeekData._sum.liters) || 0,
                revenue: Number(thisWeekData._sum.amount) || 0,
                transactions: thisWeekData._count.id || 0
            },
            lastWeek: {
                liters: Number(lastWeekData._sum.liters) || 0,
                revenue: Number(lastWeekData._sum.amount) || 0,
                transactions: lastWeekData._count.id || 0
            },
            change: {
                liters: lastWeekData._sum.liters ? ((Number(thisWeekData._sum.liters) - Number(lastWeekData._sum.liters)) / Number(lastWeekData._sum.liters) * 100) : 0,
                revenue: lastWeekData._sum.amount ? ((Number(thisWeekData._sum.amount) - Number(lastWeekData._sum.amount)) / Number(lastWeekData._sum.amount) * 100) : 0
            }
        };

        // ========== 2. Month Comparison ==========
        const [thisMonthData, lastMonthData] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: thisMonthStart },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: lastMonthStart, lte: lastMonthEnd },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            })
        ]);

        const monthComparison = {
            thisMonth: {
                liters: Number(thisMonthData._sum.liters) || 0,
                revenue: Number(thisMonthData._sum.amount) || 0,
                transactions: thisMonthData._count.id || 0
            },
            lastMonth: {
                liters: Number(lastMonthData._sum.liters) || 0,
                revenue: Number(lastMonthData._sum.amount) || 0,
                transactions: lastMonthData._count.id || 0
            },
            change: {
                liters: lastMonthData._sum.liters ? ((Number(thisMonthData._sum.liters) - Number(lastMonthData._sum.liters)) / Number(lastMonthData._sum.liters) * 100) : 0,
                revenue: lastMonthData._sum.amount ? ((Number(thisMonthData._sum.amount) - Number(lastMonthData._sum.amount)) / Number(lastMonthData._sum.amount) * 100) : 0
            }
        };

        // ========== 3. Top Customers ==========
        const topCustomers = await prisma.transaction.groupBy({
            by: ['ownerId', 'ownerName'],
            where: {
                stationId: { in: stationIds },
                date: { gte: thisMonthStart },
                isVoided: false,
                deletedAt: null,
                ownerId: { not: null }
            },
            _sum: { liters: true, amount: true },
            _count: { id: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 10
        });

        // ========== 4. Daily Heatmap (30 days) ==========
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: thirtyDaysAgo },
                isVoided: false,
                deletedAt: null
            },
            select: { date: true, amount: true, liters: true, stationId: true }
        });

        // Group by date and station
        const heatmapData: { [date: string]: { [stationId: string]: { revenue: number; liters: number } } } = {};

        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            heatmapData[dateStr] = {};
            stationIds.forEach(sid => {
                heatmapData[dateStr][sid] = { revenue: 0, liters: 0 };
            });
        }

        transactions.forEach(t => {
            const dateStr = t.date.toISOString().split('T')[0];
            if (heatmapData[dateStr] && heatmapData[dateStr][t.stationId]) {
                heatmapData[dateStr][t.stationId].revenue += Number(t.amount);
                heatmapData[dateStr][t.stationId].liters += Number(t.liters);
            }
        });

        // Convert to array format
        const heatmap = Object.entries(heatmapData).map(([date, data]) => ({
            date,
            stations: Object.entries(data).map(([sid, vals]) => ({
                stationId: sid,
                stationName: STATIONS.find(s => s.id === sid)?.name || sid,
                ...vals
            }))
        }));

        // ========== 5. Daily Trend Line (30 days) ==========
        const dailyTrend = Object.entries(heatmapData).map(([date, data]) => {
            const totals = Object.values(data).reduce(
                (acc, val) => ({ revenue: acc.revenue + val.revenue, liters: acc.liters + val.liters }),
                { revenue: 0, liters: 0 }
            );
            return { date, ...totals };
        });

        return NextResponse.json({
            weekComparison,
            monthComparison,
            topCustomers: topCustomers.map(c => ({
                ownerId: c.ownerId,
                ownerName: c.ownerName || 'ไม่ระบุ',
                liters: Number(c._sum.liters) || 0,
                revenue: Number(c._sum.amount) || 0,
                count: c._count.id
            })),
            heatmap,
            dailyTrend,
            stations: stations.map(s => ({ id: s.id, name: s.name }))
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
