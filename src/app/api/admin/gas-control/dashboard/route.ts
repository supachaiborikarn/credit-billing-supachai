import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import type { GasControlDashboard, ShiftStatus, Alert, DailySalesSummary } from '@/types/gas-control';
import { getGasStationName } from '@/types/gas-control';

// GET: Dashboard data for a gas station
export async function GET(request: NextRequest) {
    try {
        // Check admin session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId') || 'station-5';
        const dateStr = searchParams.get('date') || getTodayBangkok();

        // Use station-5/station-6 directly (this is how data is stored in DB)
        const stationName = getGasStationName(stationId);

        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Get today's daily record with shifts (use range because dates can have timezone differences)
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                shifts: {
                    include: {
                        staff: { select: { name: true } },
                        reconciliation: true,
                    },
                    orderBy: { shiftNumber: 'asc' }
                }
            }
        });

        // Get today's transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            }
        });

        const todaySales = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const todayLiters = transactions.reduce((sum, t) => sum + Number(t.liters), 0);

        // Get gauge level (latest reading)
        const latestGauge = await prisma.gaugeReading.findFirst({
            where: { stationId },
            orderBy: { date: 'desc' }
        });

        // Build shift status
        const shiftsToday: ShiftStatus[] = dailyRecord?.shifts.map(shift => ({
            id: shift.id,
            shiftNumber: shift.shiftNumber,
            shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
            status: shift.status as 'OPEN' | 'CLOSED' | 'LOCKED',
            staffName: shift.staff?.name || '-',
            totalSales: shift.reconciliation ? Number(shift.reconciliation.totalReceived) : 0
        })) || [];

        // Build alerts
        const alerts: Alert[] = [];

        // Check for open shifts
        const openShift = dailyRecord?.shifts.find(s => s.status === 'OPEN');
        if (openShift) {
            alerts.push({
                id: `alert-open-${openShift.id}`,
                type: 'SHIFT_NOT_CLOSED',
                severity: 'WARNING',
                message: `${openShift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย'}ยังเปิดอยู่`,
                shiftId: openShift.id,
                createdAt: new Date().toISOString()
            });
        }

        // Check for meter anomalies
        const recentAnomalies = await prisma.meterAnomaly.findMany({
            where: {
                shift: { dailyRecord: { stationId } },
                reviewedAt: null
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        for (const anomaly of recentAnomalies) {
            alerts.push({
                id: `alert-anomaly-${anomaly.id}`,
                type: 'ANOMALY',
                severity: anomaly.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                message: `พบความผิดปกติมิเตอร์หัว ${anomaly.nozzleNumber}`,
                shiftId: anomaly.shiftId,
                createdAt: anomaly.createdAt.toISOString()
            });
        }

        // Check low gauge
        if (latestGauge && Number(latestGauge.percentage) < 20) {
            alerts.push({
                id: `alert-gauge-low`,
                type: 'LOW_GAUGE',
                severity: Number(latestGauge.percentage) < 10 ? 'CRITICAL' : 'WARNING',
                message: `ระดับแก๊สเหลือ ${Number(latestGauge.percentage).toFixed(0)}%`,
                createdAt: latestGauge.createdAt.toISOString()
            });
        }

        // Get 7-day sales trend
        const sevenDaysAgo = new Date(startOfDay);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const trendTransactions = await prisma.transaction.findMany({
            where: {
                stationId,
                date: { gte: sevenDaysAgo, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            select: {
                date: true,
                amount: true,
                liters: true
            }
        });

        // Group by date
        const salesByDate = new Map<string, { sales: number; liters: number; count: number }>();
        for (const t of trendTransactions) {
            const dateKey = t.date.toISOString().split('T')[0];
            const existing = salesByDate.get(dateKey) || { sales: 0, liters: 0, count: 0 };
            existing.sales += Number(t.amount);
            existing.liters += Number(t.liters);
            existing.count += 1;
            salesByDate.set(dateKey, existing);
        }

        const salesTrend7Days: DailySalesSummary[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(startOfDay);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            const data = salesByDate.get(dateKey) || { sales: 0, liters: 0, count: 0 };
            salesTrend7Days.push({
                date: dateKey,
                totalSales: data.sales,
                totalLiters: data.liters,
                transactionCount: data.count
            });
        }

        const dashboard: GasControlDashboard = {
            stationId: stationId,
            stationName: stationName,
            date: dateStr,
            todaySales,
            todayTransactions: transactions.length,
            todayLiters,
            gaugeLevel: latestGauge ? Number(latestGauge.percentage) : null,
            shiftsToday,
            alerts,
            salesTrend7Days
        };

        return NextResponse.json(dashboard);
    } catch (error) {
        console.error('[Gas Control Dashboard]:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
    }
}
