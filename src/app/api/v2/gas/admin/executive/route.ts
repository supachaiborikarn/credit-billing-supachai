import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Executive Dashboard data
export async function GET(request: NextRequest) {
    try {
        const gasStations = STATIONS.filter(s => s.type === 'GAS');
        const stationIds = gasStations.map(s => s.id);

        // Date ranges
        const todayStr = getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(todayStr);
        const endOfDay = getEndOfDayBangkok(todayStr);

        const weekAgo = new Date(startOfDay);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const monthAgo = new Date(startOfDay);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        // ======== 1. FINANCIAL OVERVIEW ========
        const [todayTxs, weekTxs, monthTxs] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: startOfDay, lte: endOfDay },
                    isVoided: false, deletedAt: null
                },
                _sum: { amount: true, liters: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: weekAgo },
                    isVoided: false, deletedAt: null
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: monthAgo },
                    isVoided: false, deletedAt: null
                },
                _sum: { amount: true }
            })
        ]);

        // 7-day trend
        const trendTransactions = await prisma.transaction.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: weekAgo, lte: endOfDay },
                isVoided: false, deletedAt: null
            },
            select: { date: true, amount: true, liters: true, stationId: true }
        });

        const salesByDate = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(startOfDay);
            d.setDate(d.getDate() - i);
            salesByDate.set(d.toISOString().split('T')[0], 0);
        }
        trendTransactions.forEach(t => {
            const key = t.date.toISOString().split('T')[0];
            if (salesByDate.has(key)) {
                salesByDate.set(key, (salesByDate.get(key) || 0) + Number(t.amount));
            }
        });

        const salesTrend = Array.from(salesByDate.entries()).map(([date, amount]) => ({
            date,
            amount
        }));

        // Per-station comparison
        const stationComparison = await Promise.all(
            gasStations.map(async (station) => {
                const txs = await prisma.transaction.aggregate({
                    where: {
                        stationId: station.id,
                        date: { gte: startOfDay, lte: endOfDay },
                        isVoided: false, deletedAt: null
                    },
                    _sum: { amount: true }
                });
                return {
                    id: station.id,
                    name: station.name,
                    todaySales: Number(txs._sum.amount) || 0
                };
            })
        );

        // ======== 2. OPERATIONS ========
        const shiftsData = await Promise.all(
            gasStations.map(async (station) => {
                const dailyRecord = await prisma.dailyRecord.findFirst({
                    where: {
                        stationId: station.id,
                        date: { gte: startOfDay, lte: endOfDay }
                    },
                    include: {
                        shifts: {
                            include: {
                                staff: { select: { name: true } },
                                reconciliation: true
                            },
                            orderBy: { shiftNumber: 'asc' }
                        }
                    }
                });

                return {
                    stationName: station.name,
                    shifts: dailyRecord?.shifts.map(s => ({
                        shiftNumber: s.shiftNumber,
                        status: s.status,
                        staffName: s.staff?.name || '-',
                        totalSales: s.reconciliation ? Number(s.reconciliation.totalReceived) : 0
                    })) || []
                };
            })
        );

        // ======== 3. INVENTORY (Gauge Levels) ========
        const gaugeData = await Promise.all(
            gasStations.map(async (station) => {
                const gauges = await prisma.gaugeReading.findMany({
                    where: { stationId: station.id },
                    orderBy: { date: 'desc' },
                    take: 3,
                    distinct: ['tankNumber']
                });

                const tanks = [1, 2, 3].map(tankNum => {
                    const g = gauges.find(x => x.tankNumber === tankNum);
                    return g ? Number(g.percentage) : null;
                });

                const avg = tanks.filter(t => t !== null).length > 0
                    ? tanks.filter(t => t !== null).reduce((sum, t) => sum + (t || 0), 0) / tanks.filter(t => t !== null).length
                    : null;

                return {
                    stationName: station.name,
                    tanks,
                    average: avg,
                    isLow: avg !== null && avg < 20
                };
            })
        );

        // ======== 4. AR (Accounts Receivable) ========
        const ownersWithCredit = await prisma.owner.findMany({
            where: {
                currentCredit: { gt: 0 },
                deletedAt: null
            },
            orderBy: { currentCredit: 'desc' },
            take: 5,
            select: {
                id: true,
                name: true,
                currentCredit: true,
                creditLimit: true
            }
        });

        const totalAR = await prisma.owner.aggregate({
            where: { deletedAt: null },
            _sum: { currentCredit: true }
        });

        // ======== 5. AUDIT ========
        const recentAnomalies = await prisma.meterAnomaly.findMany({
            where: { reviewedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                shift: {
                    include: {
                        dailyRecord: { select: { stationId: true, date: true } }
                    }
                }
            }
        });

        const anomalies = recentAnomalies.map(a => ({
            id: a.id,
            nozzle: a.nozzleNumber,
            severity: a.severity,
            percentDiff: Number(a.percentDiff),
            date: a.shift.dailyRecord.date,
            stationId: a.shift.dailyRecord.stationId
        }));

        return NextResponse.json({
            financial: {
                todaySales: Number(todayTxs._sum.amount) || 0,
                todayLiters: Number(todayTxs._sum.liters) || 0,
                todayTransactions: todayTxs._count.id || 0,
                weekSales: Number(weekTxs._sum.amount) || 0,
                monthSales: Number(monthTxs._sum.amount) || 0,
                salesTrend,
                stationComparison
            },
            operations: {
                shifts: shiftsData
            },
            inventory: {
                gauges: gaugeData,
                lowStockCount: gaugeData.filter(g => g.isLow).length
            },
            ar: {
                totalOutstanding: Number(totalAR._sum.currentCredit) || 0,
                topDebtors: ownersWithCredit.map(o => ({
                    id: o.id,
                    name: o.name,
                    amount: Number(o.currentCredit),
                    limit: Number(o.creditLimit)
                }))
            },
            audit: {
                unreviewedAnomalies: anomalies.length,
                recentAnomalies: anomalies
            }
        });
    } catch (error) {
        console.error('Error fetching executive dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
