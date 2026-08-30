import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { isSimpleAdminStationId, parseSimpleAdminDays, SIMPLE_ADMIN_STATION_IDS } from '@/lib/simple/admin-read-contract';
import { getTodayBangkok } from '@/lib/date-utils';
import {
    addDaysToDateKey,
    buildFuelTypeMetrics,
    buildHourlyMetrics,
    filterOperationalRowsByDateKeyRange,
    getOperationalSalesDataset,
    listDateKeys,
    normalizeOperationalFuelType,
} from '@/lib/operational-sales';

// GET: Fuel Type & Time Analytics
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const parsedDays = parseSimpleAdminDays(searchParams.get('days'));
        if (!parsedDays.ok) return NextResponse.json({ error: parsedDays.error }, { status: 400 });
        const days = parsedDays.days;
        const selectedStation = searchParams.get('stationId');
        if (selectedStation && !isSimpleAdminStationId(selectedStation)) {
            return NextResponse.json({ error: 'Invalid SIMPLE station' }, { status: 400 });
        }
        const stationIds = selectedStation ? [selectedStation] : [...SIMPLE_ADMIN_STATION_IDS];

        const endDateKey = getTodayBangkok();
        const startDateKey = addDaysToDateKey(endDateKey, -(days - 1));
        const { rows, watcharaExternal } = await getOperationalSalesDataset({
            stationIds,
            startDateKey,
            endDateKey,
        });
        const periodRows = filterOperationalRowsByDateKeyRange(rows, startDateKey, endDateKey);

        // ========== By Fuel Type ==========
        const byFuelType = buildFuelTypeMetrics(periodRows);

        // ========== By Hour (Peak Hour Analysis) ==========
        const hourlyData = buildHourlyMetrics(periodRows);

        // ========== Daily Breakdown by Fuel Type ==========
        const dailyByFuel: { [date: string]: { [fuel: string]: number } } = {};

        listDateKeys(startDateKey, endDateKey).forEach((dateKey) => {
            dailyByFuel[dateKey] = {};
        });

        periodRows.forEach((row) => {
            const fuelType = normalizeOperationalFuelType(row.fuelType);
            if (dailyByFuel[row.dateKey]) {
                dailyByFuel[row.dateKey][fuelType] = (dailyByFuel[row.dateKey][fuelType] || 0) + row.liters;
            }
        });

        const dailyFuelData = Object.entries(dailyByFuel).map(([date, fuels]) => ({
            date,
            fuels
        }));

        // Find peak hour
        const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);

        return NextResponse.json({
            period: { days },
            byFuelType,
            hourlyData,
            peakHour: { hour: peakHour.hour, count: peakHour.count },
            dailyByFuel: dailyFuelData,
            watcharaExternal,
        });
    } catch (error) {
        console.error('Error fetching fuel-time:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
