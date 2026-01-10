import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

// GET: Get admin dashboard data for all gas stations
export async function GET(request: NextRequest) {
    try {
        const gasStations = STATIONS.filter(s => s.type === 'GAS');

        // Get date ranges
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - 1);
        monthStart.setHours(0, 0, 0, 0);

        // Get station IDs - use station config IDs directly
        const stationIds = gasStations.map(s => s.id);

        // Fetch all transactions for today/week/month
        const [todayTxs, weekTxs, monthTxs] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    createdAt: { gte: todayStart }
                },
                _sum: { amount: true, liters: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    createdAt: { gte: weekStart }
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    createdAt: { gte: monthStart }
                },
                _sum: { amount: true }
            })
        ]);

        // Fetch per-station data
        const stationsData = await Promise.all(
            gasStations.map(async (station) => {
                const index = STATIONS.findIndex(s => s.id === station.id) + 1;
                const dbId = station.id;

                // Get current open shift with staff info
                const currentShift = await prisma.shift.findFirst({
                    where: {
                        dailyRecord: {
                            stationId: dbId
                        },
                        status: 'OPEN'
                    },
                    include: {
                        staff: { select: { name: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                // Get today's transactions for this station
                const todayData = await prisma.transaction.aggregate({
                    where: {
                        stationId: dbId,
                        createdAt: { gte: todayStart }
                    },
                    _sum: { amount: true, liters: true },
                    _count: { id: true }
                });

                // Get latest gauge readings (all tanks)
                const latestGauges = await prisma.gaugeReading.findMany({
                    where: { stationId: dbId },
                    orderBy: { recordedAt: 'desc' },
                    take: 3, // Get last 3 readings (one per tank)
                    distinct: ['tankNumber']
                });

                // Calculate average gauge from latest readings
                let gaugeAverage: number | null = null;
                if (latestGauges.length > 0) {
                    const percentages = latestGauges.map(g => Number(g.percentage));
                    gaugeAverage = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
                }

                // Generate alerts
                const alerts: string[] = [];
                if (gaugeAverage !== null && gaugeAverage < 20) {
                    alerts.push('ระดับแก๊สต่ำ');
                }
                if (!currentShift) {
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
                    currentShift: currentShift ? {
                        shiftNumber: currentShift.shiftNumber,
                        status: currentShift.status,
                        staffName: currentShift.staff?.name || null
                    } : null,
                    todaySales: todayData._sum.amount || 0,
                    todayLiters: todayData._sum.liters || 0,
                    todayTransactions: todayData._count.id || 0,
                    gaugeAverage,
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
