import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '@/lib/date-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause for shifts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shiftWhere: any = {};

        if (stationId) {
            shiftWhere.dailyRecord = { stationId };
        }

        // Use proper timezone handling
        if (startDate || endDate) {
            const dateFilter: { gte?: Date; lte?: Date } = {};
            if (startDate) dateFilter.gte = getStartOfDayBangkok(startDate);
            if (endDate) dateFilter.lte = getEndOfDayBangkok(endDate);

            shiftWhere.dailyRecord = {
                ...(shiftWhere.dailyRecord || {}),
                date: dateFilter
            };
        }

        // Fetch shifts with all related data including reconciliation and transactions
        const shifts = await prisma.shift.findMany({
            where: shiftWhere,
            include: {
                dailyRecord: {
                    select: {
                        id: true,
                        date: true,
                        station: { select: { id: true, name: true } },
                        gasPrice: true
                    }
                },
                staff: { select: { name: true } },
                closedBy: { select: { name: true } },
                // Direct shift meters
                meters: {
                    select: {
                        id: true,
                        nozzleNumber: true,
                        startReading: true,
                        endReading: true,
                        soldQty: true
                    },
                    orderBy: { nozzleNumber: 'asc' }
                },
                // Include reconciliation data
                reconciliation: {
                    select: {
                        expectedFuelAmount: true,
                        expectedOtherAmount: true,
                        totalExpected: true,
                        totalReceived: true,
                        cashReceived: true,
                        creditReceived: true,
                        transferReceived: true,
                        variance: true,
                        varianceStatus: true
                    }
                }
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'desc' }
            ]
        });

        // Get transactions for each shift's daily record
        // Group by dailyRecordId for efficiency
        const dailyRecordIds = [...new Set(shifts.map(s => s.dailyRecordId))];

        const allTransactions = await prisma.transaction.findMany({
            where: {
                dailyRecordId: { in: dailyRecordIds },
                deletedAt: null,
                isVoided: false
            },
            select: {
                dailyRecordId: true,
                date: true,
                amount: true,
                liters: true,
                paymentType: true
            }
        });

        // Group transactions by dailyRecordId
        const txByDailyRecord = new Map<string, typeof allTransactions>();
        for (const tx of allTransactions) {
            if (!tx.dailyRecordId) continue;
            if (!txByDailyRecord.has(tx.dailyRecordId)) {
                txByDailyRecord.set(tx.dailyRecordId, []);
            }
            txByDailyRecord.get(tx.dailyRecordId)!.push(tx);
        }

        // Transform data with complete information
        const result = shifts.map(shift => {
            // Format date to Bangkok timezone
            const shiftDate = new Date(shift.dailyRecord.date.getTime() + 7 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            // Get meters directly from shift
            const metersWithSold = [1, 2, 3, 4].map(nozzle => {
                const meter = shift.meters.find(m => m.nozzleNumber === nozzle);
                if (!meter) {
                    return {
                        nozzleNumber: nozzle,
                        startReading: null,
                        endReading: null,
                        soldQty: null
                    };
                }
                const start = Number(meter.startReading);
                const end = meter.endReading ? Number(meter.endReading) : null;
                const sold = meter.soldQty ? Number(meter.soldQty) :
                    (end !== null && start ? end - start : null);
                return {
                    nozzleNumber: nozzle,
                    startReading: start,
                    endReading: end,
                    soldQty: sold
                };
            });

            const totalSold = metersWithSold.reduce((sum, m) => sum + (m.soldQty || 0), 0);

            // Get transactions for this shift's daily record
            // Filter by shift time range if possible
            const dailyTxs = txByDailyRecord.get(shift.dailyRecordId) || [];

            // Filter transactions by shift time range
            const shiftOpenTime = shift.createdAt;
            const shiftCloseTime = shift.closedAt || new Date();

            const shiftTxs = dailyTxs.filter(tx => {
                const txTime = new Date(tx.date);
                return txTime >= shiftOpenTime && txTime <= shiftCloseTime;
            });

            // Calculate transaction totals by payment type
            const cashAmount = shiftTxs
                .filter(t => t.paymentType === 'CASH')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const creditAmount = shiftTxs
                .filter(t => t.paymentType === 'CREDIT')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const transferAmount = shiftTxs
                .filter(t => t.paymentType === 'TRANSFER')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const cardAmount = shiftTxs
                .filter(t => t.paymentType === 'CREDIT_CARD')
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const totalTransactionAmount = cashAmount + creditAmount + transferAmount + cardAmount;
            const totalTransactionLiters = shiftTxs.reduce((sum, t) => sum + Number(t.liters), 0);

            // Get reconciliation data
            const recon = shift.reconciliation;
            const gasPrice = Number(shift.dailyRecord.gasPrice) || 0;

            return {
                id: shift.id,
                date: shiftDate,
                stationId: shift.dailyRecord.station.id,
                stationName: shift.dailyRecord.station.name,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staff: shift.staff?.name || null,
                closedBy: shift.closedBy?.name || null,
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,

                // Meter data
                meters: metersWithSold,
                totalSold,
                hasMeterData: shift.meters.length > 0,

                // Financial data from transactions
                gasPrice,
                transactionCount: shiftTxs.length,
                totalTransactionLiters,
                totalTransactionAmount,
                cashAmount,
                creditAmount,
                transferAmount,
                cardAmount,

                // Reconciliation data
                hasReconciliation: !!recon,
                expectedFuelAmount: recon ? Number(recon.expectedFuelAmount) : null,
                expectedOtherAmount: recon ? Number(recon.expectedOtherAmount) : null,
                totalExpected: recon ? Number(recon.totalExpected) : null,
                totalReceived: recon ? Number(recon.totalReceived) : null,
                reconciliationCash: recon ? Number(recon.cashReceived) : null,
                reconciliationCredit: recon ? Number(recon.creditReceived) : null,
                reconciliationTransfer: recon ? Number(recon.transferReceived) : null,
                variance: recon ? Number(recon.variance) : null,
                varianceStatus: recon?.varianceStatus || null,

                // Meter vs Transaction comparison
                meterVsTransactionDiff: totalSold - totalTransactionLiters
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
