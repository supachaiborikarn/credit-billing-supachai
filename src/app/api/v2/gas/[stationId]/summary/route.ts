import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTodayBangkok, getStartOfDayBangkokUTC, getEndOfDayBangkokUTC } from '@/lib/gas';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';

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

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const detailed = searchParams.get('detailed') === 'true';

        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        // Get today's DailyRecord (use station.dbId)
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                shifts: {
                    orderBy: { shiftNumber: 'desc' },
                    take: 1,
                    include: {
                        staff: { select: { name: true } },
                        meters: true,
                        reconciliation: true
                    }
                }
            }
        });

        if (!dailyRecord) {
            return NextResponse.json({
                shift: null,
                sales: { cash: 0, credit: 0, card: 0, transfer: 0, total: 0, transactionCount: 0, liters: 0 },
                gauge: { tank1: null, tank2: null, tank3: null, average: 0 },
                alerts: []
            });
        }

        const shift = dailyRecord.shifts[0];

        // Get today's transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: station.dbId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
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

            if (t.paymentType === 'CASH') {
                sales.cash += amt;
            } else if (t.paymentType === 'CREDIT') {
                sales.credit += amt;
            }
        }

        // Get latest gauge readings
        const latestGauge = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.dbId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
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
                meters: shift.meters.map(m => ({
                    nozzleNumber: m.nozzleNumber,
                    startReading: m.startReading ? Number(m.startReading) : null,
                    endReading: m.endReading ? Number(m.endReading) : null,
                    soldQty: m.soldQty ? Number(m.soldQty) : null
                })),
                gasPrice: Number(dailyRecord.gasPrice)
            };

            if (detailed) {
                // Add gauge start/end for close page
                const shiftGauges = await prisma.gaugeReading.findMany({
                    where: {
                        stationId: station.dbId,
                        shiftNumber: shift.shiftNumber,
                        date: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                });

                shiftData.gauge = {
                    start: shiftGauges.filter(g => g.notes === 'start').map(g => ({ tankNumber: g.tankNumber, percentage: Number(g.percentage) })),
                    end: shiftGauges.filter(g => g.notes === 'end').map(g => ({ tankNumber: g.tankNumber, percentage: Number(g.percentage) }))
                };
            }

            response.shift = shiftData;
        } else {
            response.shift = null;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Summary]:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
