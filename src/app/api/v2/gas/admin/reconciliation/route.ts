import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { getGasShiftAnalyticsData } from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
} from '@/lib/gas/date-utils';

/**
 * GET /api/v2/gas/admin/reconciliation
 * Get reconciliation records for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');
        const statusFilter = searchParams.get('status');

        const todayKey = getGasBusinessDateKey();
        const shifts = await getGasShiftAnalyticsData({
            fromDate: getStartOfDayBangkokUTC(from || todayKey),
            toDate: getEndOfDayBangkokUTC(to || todayKey),
            stationId: stationIdFilter,
            reconciledOnly: true,
        });

        let records = shifts
            .filter((shift) => shift.reconciliation?.hasRecord)
            .map((shift) => ({
                id: shift.id,
                date: shift.dateKey,
                displayDate: shift.displayDate,
                stationId: shift.stationId,
                stationName: shift.stationName,
                shiftNumber: shift.shiftNumber,
                staffName: shift.staffName,
                meterSales: shift.meters.total * shift.gasPrice,
                meterLiters: shift.meters.total,
                transactionLiters: shift.meters.transactionLiters,
                litersVariance: shift.meters.litersVariance,
                transactionCount: shift.transactionCount,
                cashExpected: shift.reconciliation!.cashExpected,
                cashReceived: shift.reconciliation!.cashReceived,
                creditExpected: shift.reconciliation!.creditExpected,
                creditReceived: shift.reconciliation!.creditReceived,
                cardExpected: shift.reconciliation!.cardExpected,
                cardReceived: shift.reconciliation!.cardReceived,
                transferExpected: shift.reconciliation!.transferExpected,
                transferReceived: shift.reconciliation!.transferReceived,
                expectedFuelAmount: shift.reconciliation!.expectedFuelAmount,
                expectedOtherAmount: shift.reconciliation!.expectedOtherAmount,
                nonGasSalesAmount: shift.reconciliation!.nonGasSalesAmount,
                otherExpensesAmount: shift.reconciliation!.otherExpensesAmount,
                totalExpected: shift.reconciliation!.expected,
                totalReceived: shift.reconciliation!.received,
                variance: shift.reconciliation!.variance,
                varianceStatus: shift.reconciliation!.varianceStatus,
                varianceSeverity: shift.reconciliation!.varianceSeverity,
                varianceNote: shift.reconciliation!.varianceNote,
            }));

        // Filter by status if specified
        if (statusFilter && statusFilter !== 'all') {
            records = records.filter((record) => record.varianceStatus === statusFilter);
        }

        return NextResponse.json({ records });
    } catch (error) {
        console.error('[Reconciliation]:', error);
        return NextResponse.json({ error: 'Failed to fetch reconciliation data' }, { status: 500 });
    }
}
