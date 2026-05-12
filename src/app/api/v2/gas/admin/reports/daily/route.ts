import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import {
    buildGasDailyAnalytics,
    getGasShiftAnalyticsData,
} from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';

function subtractBangkokDays(dateKey: string, days: number): string {
    const date = getStartOfDayBangkokUTC(dateKey);
    date.setUTCDate(date.getUTCDate() - days);
    return toBangkokDateKey(date);
}

/**
 * GET /api/v2/gas/admin/reports/daily
 * Get daily aggregated reports for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');

        const todayKey = getGasBusinessDateKey();
        const fromKey = from || subtractBangkokDays(todayKey, 7);
        const toKey = to || todayKey;

        const shifts = await getGasShiftAnalyticsData({
            fromDate: getStartOfDayBangkokUTC(fromKey),
            toDate: getEndOfDayBangkokUTC(toKey),
            stationId: stationIdFilter,
        });

        const days = buildGasDailyAnalytics(shifts);

        return NextResponse.json({ days });
    } catch (error) {
        console.error('[Daily Reports]:', error);
        return NextResponse.json({ error: 'Failed to fetch daily reports' }, { status: 500 });
    }
}
