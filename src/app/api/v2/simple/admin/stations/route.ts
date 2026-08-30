import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { parseSimpleAdminDays, SIMPLE_ADMIN_STATIONS } from '@/lib/simple/admin-read-contract';
import { getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import {
    addDaysToDateKey,
    buildNozzleMetrics,
    filterOperationalRowsByDateKeyRange,
    getOperationalSalesDataset,
    summarizeOperationalRows,
} from '@/lib/operational-sales';

// GET: Station Performance data for Simple Stations only
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const parsedDays = parseSimpleAdminDays(searchParams.get('days'));
        if (!parsedDays.ok) return NextResponse.json({ error: parsedDays.error }, { status: 400 });
        const days = parsedDays.days;
        const simpleStations = SIMPLE_ADMIN_STATIONS;
        const stationIds = simpleStations.map((station) => station.id);

        const endDateKey = getTodayBangkok();
        const startDateKey = addDaysToDateKey(endDateKey, -(days - 1));
        const { rows, watcharaExternal } = await getOperationalSalesDataset({
            stationIds,
            startDateKey,
            endDateKey,
        });

        const periodRows = filterOperationalRowsByDateKeyRange(rows, startDateKey, endDateKey);
        const stationsData = simpleStations.map((station) => {
            const stationRows = periodRows.filter((row) => row.stationId === station.id);
            const aggregate = summarizeOperationalRows(stationRows);

            return {
                id: station.id,
                name: station.name,
                totalLiters: aggregate.liters,
                totalRevenue: aggregate.revenue,
                totalTransactions: aggregate.transactions,
                margin: null,
                profit: null,
                byNozzle: buildNozzleMetrics(stationRows),
            };
        });

        stationsData.sort((a, b) => b.totalRevenue - a.totalRevenue);

        return NextResponse.json({
            period: {
                days,
                startDate: getStartOfDayBangkok(startDateKey).toISOString(),
                endDate: getEndOfDayBangkok(endDateKey).toISOString(),
            },
            stations: stationsData,
            watcharaExternal,
        });
    } catch (error) {
        console.error('Error fetching stations:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
