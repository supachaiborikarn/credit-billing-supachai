import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { getGasShiftAnalyticsData } from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
} from '@/lib/gas/date-utils';

/**
 * GET /api/v2/gas/admin/reports/meters
 * Get meter readings report for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');

        const todayKey = getTodayBangkok();
        const shifts = await getGasShiftAnalyticsData({
            fromDate: getStartOfDayBangkokUTC(from || todayKey),
            toDate: getEndOfDayBangkokUTC(to || todayKey),
            stationId: stationIdFilter,
        });

        const meters = shifts.map((shift) => ({
            id: shift.id,
            date: shift.dateKey,
            displayDate: shift.displayDate,
            stationId: shift.stationId,
            stationName: shift.stationName,
            shiftNumber: shift.shiftNumber,
            status: shift.status,
            isSyntheticOrphan: shift.isSyntheticOrphan === true,
            nozzles: shift.meters.nozzles,
            totalLiters: shift.meters.total,
            transactionLiters: shift.meters.transactionLiters,
            litersVariance: shift.meters.litersVariance,
            continuity: shift.meters.continuity,
            gasPrice: shift.gasPrice,
            expectedSales: Number((shift.meters.total * shift.gasPrice).toFixed(2)),
            actualSales: shift.reconciliation?.received ?? shift.sales.total,
            transactionCount: shift.sales.transactions,
            averagePerNozzle: shift.meters.nozzles.length > 0
                ? Number((shift.meters.total / shift.meters.nozzles.length).toFixed(2))
                : 0,
        }));

        return NextResponse.json({ meters });
    } catch (error) {
        console.error('[Meters Report]:', error);
        return NextResponse.json({ error: 'Failed to fetch meter reports' }, { status: 500 });
    }
}
