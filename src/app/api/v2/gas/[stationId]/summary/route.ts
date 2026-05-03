import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    getEndOfDayBangkokUTC,
    getGasActiveShiftDateRange,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
    toBangkokDateKey,
} from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { addToGasPaymentSummary } from '@/lib/gas/payment-utils';
import { getDefaultGasPriceForStation, resolveDailyGasPrice } from '@/lib/gas/v2-workflow';

/**
 * GET /api/v2/gas/[stationId]/summary
 * Get current shift summary for dashboard (GAS stations only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;
        const { station } = auth;

        const { searchParams } = new URL(request.url);
        const detailed = searchParams.get('detailed') === 'true';

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);
        const activeShiftRange = getGasActiveShiftDateRange(today);

        const shift = await prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: {
                    stationId: station.dbId,
                    date: {
                        gte: activeShiftRange.start,
                        lte: activeShiftRange.end,
                    },
                },
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { createdAt: 'desc' },
            ],
            include: {
                dailyRecord: true,
                staff: { select: { name: true } },
                meters: true,
                reconciliation: true,
            },
        });

        // Fall back to today's DailyRecord when no shift is open.
        const todayDailyRecord = shift ? null : await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            orderBy: { date: 'asc' },
        });
        const dailyRecord = shift?.dailyRecord ?? todayDailyRecord;

        if (!dailyRecord) {
            const defaultGasPrice = await getDefaultGasPriceForStation(prisma, station.dbId);
            return NextResponse.json({
                gasPrice: defaultGasPrice,
                shift: null,
                sales: { cash: 0, credit: 0, card: 0, transfer: 0, total: 0, transactionCount: 0, liters: 0 },
                gauge: { tank1: null, tank2: null, tank3: null, average: 0 },
                meters: [],
                transactions: [],
                alerts: []
            });
        }

        const dailyGasPrice = await resolveDailyGasPrice(prisma, station.dbId, dailyRecord.gasPrice);

        // Get current-shift transactions when a shift is open; fall back to the day for empty state.
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: station.dbId,
                ...(shift
                    ? { shiftId: shift.id }
                    : { date: { gte: startOfDay, lte: endOfDay } }),
                deletedAt: null,
                isVoided: false
            },
            include: {
                owner: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        // Aggregate sales
        const sales = {
            cash: 0,
            credit: 0,
            card: 0,
            transfer: 0,
            total: 0,
            transactionCount: transactions.length,
            liters: 0
        };

        for (const t of transactions) {
            const amt = Number(t.amount);
            sales.total += amt;
            sales.liters += Number(t.liters);

            addToGasPaymentSummary(sales, t.paymentType, amt);
        }

        // Get latest gauge readings
        const latestGauge = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.dbId,
                ...(shift
                    ? {
                        dailyRecordId: shift.dailyRecordId,
                        shiftNumber: shift.shiftNumber,
                    }
                    : { dailyRecordId: dailyRecord.id }),
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            distinct: ['tankNumber']
        });

        const gauge = {
            tank1: latestGauge.find(g => g.tankNumber === 1)?.percentage ? Number(latestGauge.find(g => g.tankNumber === 1)!.percentage) : null,
            tank2: latestGauge.find(g => g.tankNumber === 2)?.percentage ? Number(latestGauge.find(g => g.tankNumber === 2)!.percentage) : null,
            tank3: latestGauge.find(g => g.tankNumber === 3)?.percentage ? Number(latestGauge.find(g => g.tankNumber === 3)!.percentage) : null,
            average: 0
        };

        const validGauges = [gauge.tank1, gauge.tank2, gauge.tank3].filter(g => g !== null) as number[];
        gauge.average = validGauges.length > 0 ? validGauges.reduce((a, b) => a + b, 0) / validGauges.length : 0;

        // Generate alerts
        const alerts: string[] = [];
        if (gauge.tank1 !== null && gauge.tank1 < 20) alerts.push(`ถัง 1 ต่ำ (${gauge.tank1}%)`);
        if (gauge.tank2 !== null && gauge.tank2 < 20) alerts.push(`ถัง 2 ต่ำ (${gauge.tank2}%)`);
        if (gauge.tank3 !== null && gauge.tank3 < 20) alerts.push(`ถัง 3 ต่ำ (${gauge.tank3}%)`);

        // Build response
        const response: Record<string, unknown> = {
            gasPrice: dailyGasPrice,
            sales,
            gauge,
            alerts
        };

        if (shift) {
            const shiftData: Record<string, unknown> = {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staffName: shift.staff?.name || null,
                openedAt: shift.createdAt,
                closedAt: shift.closedAt,
                businessDate: toBangkokDateKey(shift.dailyRecord.date),
                dateKey: toBangkokDateKey(shift.dailyRecord.date),
                meters: shift.meters.map(m => ({
                    nozzleNumber: m.nozzleNumber,
                    startReading: m.startReading !== null ? Number(m.startReading) : null,
                    endReading: m.endReading !== null ? Number(m.endReading) : null,
                    soldQty: m.soldQty !== null ? Number(m.soldQty) : null
                })),
                gasPrice: dailyGasPrice
            };

            if (detailed) {
                // Add gauge start/end for close page
                const shiftGauges = await prisma.gaugeReading.findMany({
                    where: {
                        stationId: station.dbId,
                        dailyRecordId: shift.dailyRecordId,
                        shiftNumber: shift.shiftNumber,
                    }
                });

                shiftData.gauge = {
                    start: shiftGauges.filter(g => g.notes === 'start').map(g => ({ tankNumber: g.tankNumber, percentage: Number(g.percentage) })),
                    end: shiftGauges.filter(g => g.notes === 'end').map(g => ({ tankNumber: g.tankNumber, percentage: Number(g.percentage) }))
                };
            }

            response.shift = shiftData;
            response.meters = shift.meters.map(m => {
                const soldQty = m.soldQty
                    ? Number(m.soldQty)
                    : (m.startReading !== null && m.endReading !== null ? Number(m.endReading) - Number(m.startReading) : 0);

                return {
                    nozzle: m.nozzleNumber,
                    nozzleNumber: m.nozzleNumber,
                    startReading: m.startReading !== null ? Number(m.startReading) : null,
                    endReading: m.endReading !== null ? Number(m.endReading) : null,
                    liters: soldQty,
                    amount: soldQty * dailyGasPrice
                };
            });
        } else {
            response.shift = null;
            response.meters = [];
        }

        response.transactions = transactions.map(t => ({
            id: t.id,
            paymentType: t.paymentType,
            amount: Number(t.amount),
            liters: Number(t.liters),
            ownerName: t.owner?.name || t.ownerName || null,
            truckPlate: t.licensePlate || null,
            licensePlate: t.licensePlate || null,
            createdAt: t.createdAt
        }));

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Summary]:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
