import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Executive Dashboard for FULL Station (แท๊งลอย)
export async function GET(request: NextRequest) {
    try {
        // FULL station only (แท๊งลอยวัชรเกียรติ)
        const fullStation = STATIONS.find(s => s.type === 'FULL');
        if (!fullStation) {
            return NextResponse.json({ error: 'No FULL station found' }, { status: 404 });
        }

        const stationId = fullStation.id;

        // Date ranges
        const todayStr = getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(todayStr);
        const endOfDay = getEndOfDayBangkok(todayStr);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(startOfDay);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // ========== KPI Cards ==========
        const [todayData, monthData] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    stationId,
                    date: { gte: startOfDay, lte: endOfDay },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    stationId,
                    date: { gte: monthStart },
                    isVoided: false,
                    deletedAt: null
                },
                _sum: { liters: true, amount: true },
                _count: { id: true }
            })
        ]);

        // ========== 30-Day Trend ==========
        const trendTransactions = await prisma.transaction.findMany({
            where: {
                stationId,
                date: { gte: thirtyDaysAgo, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            select: { date: true, amount: true, liters: true }
        });

        const salesByDate = new Map<string, { revenue: number; liters: number; count: number }>();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(startOfDay);
            d.setDate(d.getDate() - i);
            salesByDate.set(d.toISOString().split('T')[0], { revenue: 0, liters: 0, count: 0 });
        }

        trendTransactions.forEach(t => {
            const key = t.date.toISOString().split('T')[0];
            if (salesByDate.has(key)) {
                const existing = salesByDate.get(key)!;
                existing.revenue += Number(t.amount);
                existing.liters += Number(t.liters);
                existing.count += 1;
            }
        });

        const dailyTrend = Array.from(salesByDate.entries()).map(([date, data]) => ({
            date,
            ...data
        }));

        // ========== Anomaly Detection ==========
        const anomalies: Array<{
            type: string;
            severity: 'WARNING' | 'CRITICAL';
            message: string;
            date: string;
            details?: Record<string, unknown>;
        }> = [];

        // 1. Check for unusual daily volume (>2 std dev from 30-day average)
        const dailyVolumes = dailyTrend.map(d => d.liters);
        const avgVolume = dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length;
        const stdDev = Math.sqrt(dailyVolumes.map(v => Math.pow(v - avgVolume, 2)).reduce((a, b) => a + b, 0) / dailyVolumes.length);

        const todayLiters = Number(todayData._sum.liters) || 0;
        if (todayLiters > 0 && Math.abs(todayLiters - avgVolume) > 2 * stdDev) {
            anomalies.push({
                type: 'UNUSUAL_VOLUME',
                severity: todayLiters > avgVolume ? 'WARNING' : 'CRITICAL',
                message: todayLiters > avgVolume
                    ? `ยอดขายวันนี้สูงผิดปกติ (${todayLiters.toFixed(0)} L vs avg ${avgVolume.toFixed(0)} L)`
                    : `ยอดขายวันนี้ต่ำผิดปกติ (${todayLiters.toFixed(0)} L vs avg ${avgVolume.toFixed(0)} L)`,
                date: todayStr,
                details: { todayLiters, avgVolume, stdDev }
            });
        }

        // 2. Check for voided transactions today
        const voidedToday = await prisma.transaction.count({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                isVoided: true
            }
        });

        if (voidedToday > 0) {
            anomalies.push({
                type: 'VOIDED_TRANSACTIONS',
                severity: voidedToday >= 3 ? 'CRITICAL' : 'WARNING',
                message: `มีรายการยกเลิก ${voidedToday} รายการวันนี้`,
                date: todayStr,
                details: { count: voidedToday }
            });
        }

        // 3. Check for large single transactions (> 5000 baht)
        const largeTransactions = await prisma.transaction.findMany({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                amount: { gte: 5000 },
                isVoided: false,
                deletedAt: null
            },
            select: { id: true, amount: true, liters: true, paymentType: true }
        });

        if (largeTransactions.length > 0) {
            anomalies.push({
                type: 'LARGE_TRANSACTIONS',
                severity: 'WARNING',
                message: `มีรายการมูลค่าสูง ${largeTransactions.length} รายการ (>5,000 บาท)`,
                date: todayStr,
                details: { count: largeTransactions.length, transactions: largeTransactions }
            });
        }

        // ========== Fuel Type Breakdown ==========
        const byFuelType = await prisma.transaction.groupBy({
            by: ['productType'],
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            _sum: { liters: true, amount: true },
            _count: { id: true }
        });

        return NextResponse.json({
            station: {
                id: fullStation.id,
                name: fullStation.name
            },
            kpi: {
                today: {
                    liters: Number(todayData._sum.liters) || 0,
                    revenue: Number(todayData._sum.amount) || 0,
                    transactions: todayData._count.id || 0
                },
                month: {
                    liters: Number(monthData._sum.liters) || 0,
                    revenue: Number(monthData._sum.amount) || 0,
                    transactions: monthData._count.id || 0
                }
            },
            dailyTrend,
            byFuelType: byFuelType.map(f => ({
                fuelType: f.productType || 'อื่นๆ',
                liters: Number(f._sum.liters) || 0,
                revenue: Number(f._sum.amount) || 0,
                count: f._count.id
            })),
            anomalies,
            stats: {
                avgDailyVolume: avgVolume,
                stdDevVolume: stdDev
            }
        });
    } catch (error) {
        console.error('Error fetching FULL station dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
