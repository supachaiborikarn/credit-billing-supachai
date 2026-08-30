import { NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    getGasAnalyticsStationIds,
    getGasShiftAnalyticsData,
} from '@/lib/gas/admin-analytics';
import {
    buildGasDashboardSalesSummary,
    buildGasDashboardStationSummary,
    buildLatestGaugeSummary,
    getGasDashboardDateWindow,
} from '@/lib/gas/admin-dashboard';
import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
} from '@/lib/gas/date-utils';
import { prisma } from '@/lib/prisma';

// GET: admin dashboard data for all configured GAS stations.
export async function GET() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const gasStations = STATIONS.filter((station) => station.type === 'GAS');
        const dateWindow = getGasDashboardDateWindow(getGasBusinessDateKey());
        const shiftFacts = await getGasShiftAnalyticsData({
            fromDate: getStartOfDayBangkokUTC(dateWindow.monthStartKey),
            toDate: getEndOfDayBangkokUTC(dateWindow.todayKey),
        });

        const gaugeRowsByStation = await Promise.all(
            gasStations.map(async (station) => {
                const stationIds = getGasAnalyticsStationIds(station.id);
                const latestByTank = await Promise.all(
                    [1, 2, 3].map((tankNumber) => prisma.gaugeReading.findFirst({
                        where: {
                            stationId: { in: stationIds },
                            tankNumber,
                        },
                        select: {
                            tankNumber: true,
                            percentage: true,
                        },
                        orderBy: { createdAt: 'desc' },
                    }))
                );
                return latestByTank.filter((reading): reading is NonNullable<typeof reading> => Boolean(reading));
            })
        );

        const stations = gasStations.map((station, stationIndex) => {
            const stationSummary = buildGasDashboardStationSummary(
                shiftFacts,
                station.id,
                dateWindow.todayKey
            );
            const gaugeSummary = buildLatestGaugeSummary(gaugeRowsByStation[stationIndex]);
            const alerts: string[] = [];
            if (gaugeSummary.hasLowTank) alerts.push('ระดับแก๊สต่ำ');
            if (!stationSummary.currentShift) alerts.push('ยังไม่เปิดกะ');

            return {
                id: station.id,
                name: station.name,
                index: STATIONS.findIndex((item) => item.id === station.id) + 1,
                ...stationSummary,
                totalShifts: 2,
                gaugeAverage: gaugeSummary.average,
                alerts,
            };
        });

        const recentAlerts = stations.flatMap((station) => (
            station.alerts.map((alert) => `${station.name}: ${alert}`)
        ));

        return NextResponse.json({
            summary: buildGasDashboardSalesSummary(shiftFacts, dateWindow),
            stations,
            recentAlerts,
        });
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard data' },
            { status: 500 }
        );
    }
}
