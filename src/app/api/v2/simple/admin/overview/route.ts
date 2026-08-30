import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { SIMPLE_ADMIN_STATIONS } from '@/lib/simple/admin-read-contract';
import { getTodayBangkok } from '@/lib/date-utils';
import {
    addDaysToDateKey,
    buildDailyMetrics,
    filterOperationalRowsByDateKeyRange,
    getMonthStartDateKey,
    getOperationalSalesDataset,
    summarizeOperationalRows,
} from '@/lib/operational-sales';

// GET: Executive Overview data for Simple Stations only
export async function GET() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const simpleStations = SIMPLE_ADMIN_STATIONS;
        const stationIds = simpleStations.map(s => s.id);

        // Date ranges
        const todayKey = getTodayBangkok();
        const monthStartKey = getMonthStartDateKey(todayKey);
        const trendStartKey = addDaysToDateKey(todayKey, -29);
        const datasetStartKey = trendStartKey < monthStartKey ? trendStartKey : monthStartKey;

        const { rows, watcharaExternal } = await getOperationalSalesDataset({
            stationIds,
            startDateKey: datasetStartKey,
            endDateKey: todayKey,
        });

        const todayData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, todayKey, todayKey)
        );
        const monthData = summarizeOperationalRows(
            filterOperationalRowsByDateKeyRange(rows, monthStartKey, todayKey)
        );
        const dailyTrend = buildDailyMetrics(
            Array.from({ length: 30 }, (_, index) => addDaysToDateKey(trendStartKey, index)),
            filterOperationalRowsByDateKeyRange(rows, trendStartKey, todayKey)
        );

        // ========== Per-Station Summary ==========
        const todayRows = filterOperationalRowsByDateKeyRange(rows, todayKey, todayKey);
        const stationsSummary = simpleStations.map((station) => {
            const data = summarizeOperationalRows(
                todayRows.filter((row) => row.stationId === station.id)
            );

            return {
                id: station.id,
                name: station.name,
                todayLiters: data.liters,
                todayRevenue: data.revenue,
                todayTransactions: data.transactions,
            };
        });

        return NextResponse.json({
            kpi: {
                today: {
                    liters: todayData.liters,
                    revenue: todayData.revenue,
                    transactions: todayData.transactions,
                },
                month: {
                    liters: monthData.liters,
                    revenue: monthData.revenue,
                    transactions: monthData.transactions,
                },
                margin: null,
                profit: null
            },
            dailyTrend,
            stations: stationsSummary,
            watcharaExternal,
        });
    } catch (error) {
        console.error('Error fetching overview:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
