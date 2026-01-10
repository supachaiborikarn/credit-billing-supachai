import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

/**
 * GET /api/v2/gas/admin/reconciliation
 * Get reconciliation records for Gas Control Center
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const stationIdFilter = searchParams.get('stationId');
        const statusFilter = searchParams.get('status');

        const fromDate = from ? new Date(from + 'T00:00:00+07:00') : new Date();
        const toDate = to ? new Date(to + 'T23:59:59+07:00') : new Date();

        // Get GAS station IDs
        const gasStationIds = STATIONS
            .filter(s => s.type === 'GAS')
            .map(s => s.id);

        const stationIds = stationIdFilter && stationIdFilter !== 'all'
            ? [stationIdFilter]
            : gasStationIds;

        // Get shifts with reconciliation data
        const shifts = await prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId: { in: stationIds },
                    date: {
                        gte: fromDate,
                        lte: toDate
                    }
                },
                reconciliation: {
                    isNot: null
                }
            },
            include: {
                dailyRecord: {
                    include: { station: true }
                },
                staff: {
                    select: { name: true }
                },
                meters: true,
                reconciliation: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Format and filter by status
        let records = shifts.map(shift => {
            const totalLiters = shift.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0);
            const gasPrice = Number(shift.dailyRecord.gasPrice || 16.09);
            const meterSales = totalLiters * gasPrice;

            const rec = shift.reconciliation!;
            const variance = Number(rec.variance);
            const varianceStatus = variance > 1 ? 'OVER' as const :
                variance < -1 ? 'SHORT' as const : 'BALANCED' as const;

            return {
                id: shift.id,
                date: shift.dailyRecord.date.toISOString().split('T')[0],
                displayDate: shift.dailyRecord.date.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                stationId: shift.dailyRecord.stationId,
                stationName: shift.dailyRecord.station?.name || 'Unknown',
                shiftNumber: shift.shiftNumber,
                staffName: shift.staff?.name || null,
                meterSales,
                cashExpected: meterSales,
                cashReceived: Number(rec.cashReceived),
                creditExpected: 0,
                creditReceived: Number(rec.creditReceived),
                totalExpected: Number(rec.totalExpected),
                totalReceived: Number(rec.totalReceived),
                variance,
                varianceStatus
            };
        });

        // Filter by status if specified
        if (statusFilter && statusFilter !== 'all') {
            records = records.filter(r => r.varianceStatus === statusFilter);
        }

        return NextResponse.json({ records });
    } catch (error) {
        console.error('[Reconciliation]:', error);
        return NextResponse.json({ error: 'Failed to fetch reconciliation data' }, { status: 500 });
    }
}
