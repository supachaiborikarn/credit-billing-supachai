/**
 * Dashboard Service - รวม logic สำหรับ Dashboard
 * 
 * แยกออกมาจาก API route เพื่อให้ reuse และ test ได้ง่าย
 */

import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { VARIANCE_THRESHOLD, getVarianceLevel } from '@/constants/thresholds';

export interface DashboardOverview {
    totalOwners: number;
    totalTrucks: number;
    todayTransactions: number;
    todayAmount: number;
    todayLiters: number;
    pendingInvoices: number;
    pendingAmount: number;
    amountPercentChange: number;
    litersPercentChange: number;
}

export interface Alert {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

/**
 * คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง
 */
export function calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

/**
 * ตรวจสอบ anomaly จากยอดขาย
 */
export function detectSalesAnomaly(
    todayAmount: number,
    yesterdayAmount: number
): Alert | null {
    const percentChange = calculatePercentChange(todayAmount, yesterdayAmount);

    // Alert ถ้าเปลี่ยนแปลงเกิน 30%
    if (Math.abs(percentChange) > 30 && yesterdayAmount > 0) {
        return {
            type: 'sales',
            severity: percentChange > 0 ? 'info' : 'warning',
            message: percentChange > 0
                ? `ยอดขายวันนี้พุ่งขึ้น ${percentChange.toFixed(0)}% จากเมื่อวาน`
                : `ยอดขายวันนี้ลดลง ${Math.abs(percentChange).toFixed(0)}% จากเมื่อวาน`
        };
    }
    return null;
}

/**
 * ตรวจสอบความแตกต่างของยอดเงิน (variance)
 */
export function checkVariance(expected: number, actual: number): {
    variance: number;
    level: 'ok' | 'warning' | 'critical';
    message: string;
} {
    const variance = actual - expected;
    const level = getVarianceLevel(variance);

    let message = 'ยอดตรงกัน';
    if (level === 'warning') {
        message = `⚠️ ยอดต่าง ${Math.abs(variance).toFixed(2)} บาท`;
    } else if (level === 'critical') {
        message = `🚨 ยอดต่างมาก ${Math.abs(variance).toFixed(2)} บาท`;
    }

    return { variance, level, message };
}

/**
 * สร้าง weekly sales chart data
 */
export function generateWeeklyChartData(
    transactions: Array<{ date: Date; amount: unknown; liters: unknown }>,
    baseDate: string
): Array<{ date: string; dayName: string; amount: number; liters: number; count: number }> {
    const weeklyData = [];

    for (let i = 6; i >= 0; i--) {
        const day = new Date(baseDate);
        day.setDate(day.getDate() - i);
        const dayStr = day.toISOString().split('T')[0];

        const dayTransactions = transactions.filter(t =>
            new Date(t.date).toISOString().split('T')[0] === dayStr
        );

        weeklyData.push({
            date: dayStr,
            dayName: day.toLocaleDateString('th-TH', { weekday: 'short' }),
            amount: dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
            liters: dayTransactions.reduce((sum, t) => sum + Number(t.liters), 0),
            count: dayTransactions.length
        });
    }

    return weeklyData;
}

/**
 * สร้าง top customers ranking
 */
export function generateTopCustomers(
    transactions: Array<{
        amount: unknown;
        liters: unknown;
        owner: { id: string; name: string; code: string | null } | null;
    }>,
    limit: number = 5
): Array<{ id: string; name: string; code: string | null; amount: number; liters: number; count: number }> {
    const customerStats: Record<string, {
        id: string;
        name: string;
        code: string | null;
        amount: number;
        liters: number;
        count: number;
    }> = {};

    transactions.forEach(t => {
        if (t.owner) {
            if (!customerStats[t.owner.id]) {
                customerStats[t.owner.id] = {
                    id: t.owner.id,
                    name: t.owner.name,
                    code: t.owner.code,
                    amount: 0,
                    liters: 0,
                    count: 0
                };
            }
            customerStats[t.owner.id].amount += Number(t.amount);
            customerStats[t.owner.id].liters += Number(t.liters);
            customerStats[t.owner.id].count += 1;
        }
    });

    return Object.values(customerStats)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
}

/**
 * สร้าง heat map data จากยอดรายวัน
 */
export function generateHeatMapData(
    transactions: Array<{ date: Date; amount: unknown }>
): Array<{ date: string; amount: number }> {
    const dailyTotals: Record<string, number> = {};

    transactions.forEach(t => {
        const dayStr = new Date(t.date).toISOString().split('T')[0];
        if (!dailyTotals[dayStr]) {
            dailyTotals[dayStr] = 0;
        }
        dailyTotals[dayStr] += Number(t.amount);
    });

    return Object.entries(dailyTotals)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
