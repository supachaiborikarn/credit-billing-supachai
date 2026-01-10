import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Get admin dashboard data for all gas stations
export async function GET(request: NextRequest) {
    try {
        const gasStations = STATIONS.filter(s => s.type === 'GAS');

        // Get date ranges using Bangkok timezone
        const todayStr = getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(todayStr);
        const endOfDay = getEndOfDayBangkok(todayStr);

        // Week ago
        const weekAgo = new Date(startOfDay);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Month ago
        const monthAgo = new Date(startOfDay);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        // Get station IDs - use station config IDs directly
        const stationIds = gasStations.map(s => s.id);

        // Fetch all transactions for today/week/month
        const [todayTxs, weekTxs, monthTxs] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: startOfDay, lte: endOfDay },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { amount: true, liters: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: weekAgo },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    date: { gte: monthAgo },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { amount: true }
            })
        ]);

        // Fetch per-station data
        const now = new Date();
        const stationsData = await Promise.all(
            gasStations.map(async (station) => {
                const index = STATIONS.findIndex(s => s.id === station.id) + 1;
                const dbId = station.id;

                // Get today's daily record with shifts
                const dailyRecord = await prisma.dailyRecord.findFirst({
                    where: {
                        stationId: dbId,
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

                // Find open shift
                const openShift = dailyRecord?.shifts.find(s => s.status === 'OPEN');

                // Get today's transactions for this station
                const transactions = await prisma.transaction.findMany({
                    where: {
                        stationId: dbId,
                        date: { gte: startOfDay, lte: endOfDay },
                        isVoided: false,
                        deletedAt: null
                    }
                });

                const todaySales = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
                const todayLiters = transactions.reduce((sum, t) => sum + Number(t.liters), 0);

                // Get latest gauge reading
                const latestGauge = await prisma.gaugeReading.findFirst({
                    where: { stationId: dbId },
                    orderBy: { date: 'desc' }
                });

                // Generate alerts
                const alerts: string[] = [];
                if (latestGauge && Number(latestGauge.percentage) < 20) {
                    alerts.push('ระดับแก๊สต่ำ');
                }
                if (!openShift) {
                    // Only alert during business hours (6am - 10pm)
                    const hour = now.getHours();
                    if (hour >= 6 && hour <= 22) {
                        alerts.push('ยังไม่เปิดกะ');
                    }
                }

                return {
                    id: station.id,
                    name: station.name,
                    index,
                    currentShift: openShift ? {
                        shiftNumber: openShift.shiftNumber,
                        status: openShift.status,
                        staffName: openShift.staff?.name || null
                    } : null,
                    shiftsToday: dailyRecord?.shifts.length || 0,
                    totalShifts: 2,
                    todaySales,
                    todayLiters,
                    todayTransactions: transactions.length,
                    gaugeAverage: latestGauge ? Number(latestGauge.percentage) : null,
                    alerts
                };
            })
        );

        // Collect all alerts
        const recentAlerts: string[] = [];
        stationsData.forEach(s => {
            s.alerts.forEach(alert => {
                recentAlerts.push(`${s.name}: ${alert}`);
            });
        });

        return NextResponse.json({
            summary: {
                todayTotal: todayTxs._sum.amount || 0,
                weekTotal: weekTxs._sum.amount || 0,
                monthTotal: monthTxs._sum.amount || 0,
                todayTransactions: todayTxs._count.id || 0,
                todayLiters: todayTxs._sum.liters || 0
            },
            stations: stationsData,
            recentAlerts
        });
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard data' },
            { status: 500 }
        );
    }
}
