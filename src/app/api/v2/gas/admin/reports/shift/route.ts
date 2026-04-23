import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { getGasShiftAnalyticsData } from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
} from '@/lib/gas/date-utils';

/**
 * GET /api/v2/gas/admin/reports/shift
 * Get shift reports for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');
        const shiftFilter = searchParams.get('shift');

        const todayKey = getTodayBangkok();
        const fromDate = getStartOfDayBangkokUTC(from || todayKey);
        const toDate = getEndOfDayBangkokUTC(to || todayKey);
        const shiftNumber = shiftFilter && shiftFilter !== 'all'
            ? Number.parseInt(shiftFilter, 10)
            : null;

        const shifts = await getGasShiftAnalyticsData({
            fromDate,
            toDate,
            stationId: stationIdFilter,
            shiftNumber,
        });

        const formattedShifts = shifts.map((shift) => ({
            id: shift.id,
            stationId: shift.stationId,
            stationName: shift.stationName,
            dateKey: shift.dateKey,
            displayDate: shift.displayDate,
            shiftNumber: shift.shiftNumber,
            staffName: shift.staffName,
            openedAt: shift.openedAt,
            closedAt: shift.closedAt,
            status: shift.status,
            meters: {
                total: shift.meters.total,
                transactionLiters: shift.meters.transactionLiters,
                litersVariance: shift.meters.litersVariance,
                nozzles: shift.meters.nozzles,
            },
            sales: {
                total: shift.sales.total,
                liters: shift.sales.liters,
                transactions: shift.sales.transactions,
                cash: shift.sales.cash,
                credit: shift.sales.credit,
                card: shift.sales.card,
                transfer: shift.sales.transfer,
                averageTicket: shift.sales.averageTicket,
                expectedPayments: shift.sales.expectedPayments,
            },
            reconciliation: shift.reconciliation?.hasRecord ? {
                expected: shift.reconciliation.expected,
                received: shift.reconciliation.received,
                variance: shift.reconciliation.variance,
                varianceStatus: shift.reconciliation.varianceStatus,
                varianceSeverity: shift.reconciliation.varianceSeverity,
                cashExpected: shift.reconciliation.cashExpected,
                cashReceived: shift.reconciliation.cashReceived,
                creditExpected: shift.reconciliation.creditExpected,
                creditReceived: shift.reconciliation.creditReceived,
                cardExpected: shift.reconciliation.cardExpected,
                cardReceived: shift.reconciliation.cardReceived,
                transferExpected: shift.reconciliation.transferExpected,
                transferReceived: shift.reconciliation.transferReceived,
                varianceNote: shift.reconciliation.varianceNote,
            } : null,
        }));

        return NextResponse.json({ shifts: formattedShifts });
    } catch (error) {
        console.error('[Shift Reports]:', error);
        return NextResponse.json({ error: 'Failed to fetch shift reports' }, { status: 500 });
    }
}
