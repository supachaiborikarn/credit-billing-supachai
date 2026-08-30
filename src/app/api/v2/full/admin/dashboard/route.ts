import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import { getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import {
    buildFullDashboardFacts,
    getFullDashboardDateWindow,
    isValidFullDashboardDateKey,
} from '@/lib/full/admin-dashboard';
import { getOperationalSalesDataset } from '@/lib/operational-sales';
import { prisma } from '@/lib/prisma';

// GET: Executive Dashboard for FULL Station (แท๊งลอย)
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const fullStation = STATIONS.find((station) => station.type === 'FULL');
        if (!fullStation) {
            return NextResponse.json({ error: 'No FULL station found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const selectedDateKey = searchParams.get('date') || getTodayBangkok();
        if (!isValidFullDashboardDateKey(selectedDateKey)) {
            return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
        }

        const dateWindow = getFullDashboardDateWindow(selectedDateKey);
        const selectedStart = getStartOfDayBangkok(selectedDateKey);
        const selectedEnd = getEndOfDayBangkok(selectedDateKey);
        const [{ rows }, voidedCount] = await Promise.all([
            getOperationalSalesDataset({
                stationIds: [fullStation.id],
                startDateKey: dateWindow.datasetStartKey,
                endDateKey: selectedDateKey,
            }),
            prisma.transaction.count({
                where: {
                    stationId: fullStation.id,
                    date: { gte: selectedStart, lte: selectedEnd },
                    isVoided: true,
                    deletedAt: null,
                },
            }),
        ]);

        const facts = buildFullDashboardFacts(rows, selectedDateKey, voidedCount);

        return NextResponse.json({
            station: { id: fullStation.id, name: fullStation.name },
            kpi: facts.kpi,
            dailyTrend: facts.dailyTrend,
            byFuelType: facts.byFuelType,
            anomalies: facts.anomalies,
            stats: facts.stats,
            period: {
                selectedDate: selectedDateKey,
                monthStart: dateWindow.monthStartKey,
                trendStart: dateWindow.trendStartKey,
            },
        });
    } catch (error) {
        console.error('Error fetching FULL station dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
