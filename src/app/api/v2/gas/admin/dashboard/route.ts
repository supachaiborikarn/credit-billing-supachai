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
                _sum: { totalAmount: true, liters: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    createdAt: { gte: weekStart }
                },
                _sum: { totalAmount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId: { in: stationIds },
                    createdAt: { gte: monthStart }
                },
                _sum: { totalAmount: true }
            })
        ]);

        // Fetch per-station data
        const stationsData = await Promise.all(
            gasStations.map(async (station, i) => {
                const index = STATIONS.findIndex(s => s.id === station.id) + 1;
                const dbId = station.id;

                // Get current open shift
                const currentShift = await prisma.shift.findFirst({
                    where: {
                        stationId: dbId,
                        status: 'OPEN'
                    },
                    orderBy: { startTime: 'desc' }
                });

                // Get today's transactions for this station
                const todayData = await prisma.transaction.aggregate({
                    where: {
                        stationId: dbId,
                        createdAt: { gte: todayStart }
                    },
                    _sum: { totalAmount: true, liters: true },
                    _count: { id: true }
                });

                // Get latest gauge reading
                const latestGauge = await prisma.gaugeReading.findFirst({
                    where: { stationId: dbId },
                    orderBy: { recordedAt: 'desc' }
                });

                // Calculate average gauge
                let gaugeAverage: number | null = null;
                if (latestGauge) {
                    const tanks = [
                        latestGauge.tank1Pct,
                        latestGauge.tank2Pct,
                        latestGauge.tank3Pct
                    ].filter(t => t !== null) as number[];
                    if (tanks.length > 0) {
                        gaugeAverage = tanks.reduce((sum, t) => sum + t, 0) / tanks.length;
                    }
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
                        staffName: currentShift.staffName
                    } : null,
                    todaySales: todayData._sum.totalAmount || 0,
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
                todayTotal: todayTxs._sum.totalAmount || 0,
                weekTotal: weekTxs._sum.totalAmount || 0,
                monthTotal: monthTxs._sum.totalAmount || 0,
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
