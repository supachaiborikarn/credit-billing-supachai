import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import { isSimpleAdminStationId, SIMPLE_ADMIN_STATIONS } from '@/lib/simple/admin-read-contract';
import { getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import {
    addDaysToDateKey,
    buildStationDailyMatrix,
    filterOperationalRowsByDateKeyRange,
    getMonthStartDateKey,
    getOperationalSalesDataset,
    listDateKeys,
    summarizeOperationalRows,
} from '@/lib/operational-sales';

// GET: Advanced Analytics for Simple/FULL stations
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const stationType = searchParams.get('type') || 'SIMPLE';
        if (stationType !== 'SIMPLE') {
            return NextResponse.json({ error: 'Only SIMPLE analytics are supported by this endpoint' }, { status: 400 });
        }
        if (stationId && !isSimpleAdminStationId(stationId)) {
            return NextResponse.json({ error: 'Invalid SIMPLE station' }, { status: 400 });
        }

        let stations = [...SIMPLE_ADMIN_STATIONS];
        if (stationId) stations = stations.filter((station) => station.id === stationId);
        const stationIds = stations.map(s => s.id);

        if (stationIds.length === 0) {
            return NextResponse.json({ error: 'No stations found' }, { status: 404 });
        }

        const todayKey = getTodayBangkok();
        const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

        // Date ranges
        const thisWeekStartKey = addDaysToDateKey(todayKey, -todayDate.getUTCDay());
        const lastWeekStartKey = addDaysToDateKey(thisWeekStartKey, -7);
        const lastWeekEndKey = addDaysToDateKey(thisWeekStartKey, -1);
        const thisMonthStartKey = getMonthStartDateKey(todayKey);
        const lastMonthEndKey = addDaysToDateKey(thisMonthStartKey, -1);
        const lastMonthStartKey = getMonthStartDateKey(lastMonthEndKey);
        const heatmapStartKey = addDaysToDateKey(todayKey, -29);
        const datasetStartKey = lastMonthStartKey < heatmapStartKey ? lastMonthStartKey : heatmapStartKey;

        const { rows, watcharaExternal } = await getOperationalSalesDataset({
            stationIds,
            startDateKey: datasetStartKey,
            endDateKey: todayKey,
        });

        // ========== 1. Week Comparison ==========
        const thisWeekData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, thisWeekStartKey, todayKey)
        );
        const lastWeekData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, lastWeekStartKey, lastWeekEndKey)
        );

        const weekComparison = {
            thisWeek: {
                liters: thisWeekData.liters,
                revenue: thisWeekData.revenue,
                transactions: thisWeekData.transactions,
            },
            lastWeek: {
                liters: lastWeekData.liters,
                revenue: lastWeekData.revenue,
                transactions: lastWeekData.transactions,
            },
            change: {
                liters: lastWeekData.liters ? ((thisWeekData.liters - lastWeekData.liters) / lastWeekData.liters) * 100 : 0,
                revenue: lastWeekData.revenue ? ((thisWeekData.revenue - lastWeekData.revenue) / lastWeekData.revenue) * 100 : 0,
            },
        };

        // ========== 2. Month Comparison ==========
        const thisMonthData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, thisMonthStartKey, todayKey)
        );
        const lastMonthData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, lastMonthStartKey, lastMonthEndKey)
        );

        const monthComparison = {
            thisMonth: {
                liters: thisMonthData.liters,
                revenue: thisMonthData.revenue,
                transactions: thisMonthData.transactions,
            },
            lastMonth: {
                liters: lastMonthData.liters,
                revenue: lastMonthData.revenue,
                transactions: lastMonthData.transactions,
            },
            change: {
                liters: lastMonthData.liters ? ((thisMonthData.liters - lastMonthData.liters) / lastMonthData.liters) * 100 : 0,
                revenue: lastMonthData.revenue ? ((thisMonthData.revenue - lastMonthData.revenue) / lastMonthData.revenue) * 100 : 0,
            },
        };

        // ========== 3. Top Customers ==========
        const topCustomers = await prisma.transaction.groupBy({
            by: ['ownerId', 'ownerName'],
            where: {
                stationId: { in: stationIds },
                date: {
                    gte: getStartOfDayBangkok(thisMonthStartKey),
                    lte: getEndOfDayBangkok(todayKey),
                },
                isVoided: false,
                deletedAt: null,
                ownerId: { not: null },
            },
            _sum: { liters: true, amount: true },
            _count: { id: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 10,
        });

        // ========== 4. Daily Heatmap (30 days) ==========
        const heatmapDateKeys = listDateKeys(heatmapStartKey, todayKey);
        const heatmapMatrix = buildStationDailyMatrix(
            heatmapDateKeys,
            stationIds,
            filterOperationalRowsByDateKeyRange(rows, heatmapStartKey, todayKey)
        );

        // Convert to array format
        const heatmap = heatmapDateKeys.map((date) => ({
            date,
            stations: stationIds.map((sid) => ({
                stationId: sid,
                stationName: STATIONS.find(s => s.id === sid)?.name || sid,
                revenue: heatmapMatrix[date][sid].revenue,
                liters: heatmapMatrix[date][sid].liters,
            }))
        }));

        // ========== 5. Daily Trend Line (30 days) ==========
        const dailyTrend = heatmapDateKeys.map((date) => {
            const totals = stationIds.reduce(
                (acc, stationId) => ({
                    revenue: acc.revenue + heatmapMatrix[date][stationId].revenue,
                    liters: acc.liters + heatmapMatrix[date][stationId].liters,
                }),
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
            stations: stations.map(s => ({ id: s.id, name: s.name })),
            topCustomersScope: 'internal_pos_only',
            watcharaExternal,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
