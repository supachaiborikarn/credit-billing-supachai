import type { OperationalSaleRow } from '@/lib/operational-sales';
import {
    addDaysToDateKey,
    buildDailyMetrics,
    buildFuelTypeMetrics,
    filterOperationalRowsByDateKeyRange,
    getMonthStartDateKey,
    listDateKeys,
    summarizeOperationalRows,
} from '@/lib/operational-sales';

export type FullDashboardAnomaly = {
    type: 'UNUSUAL_VOLUME' | 'VOIDED_TRANSACTIONS' | 'SUDDEN_DROP';
    severity: 'WARNING' | 'CRITICAL';
    message: string;
    date: string;
    details?: Record<string, unknown>;
};

export function isValidFullDashboardDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

export function getFullDashboardDateWindow(selectedDateKey: string) {
    const trendStartKey = addDaysToDateKey(selectedDateKey, -29);
    const monthStartKey = getMonthStartDateKey(selectedDateKey);
    return {
        selectedDateKey,
        trendStartKey,
        monthStartKey,
        datasetStartKey: trendStartKey < monthStartKey ? trendStartKey : monthStartKey,
    };
}

export function buildFullDashboardFacts(
    rows: OperationalSaleRow[],
    selectedDateKey: string,
    voidedCount = 0
) {
    const window = getFullDashboardDateWindow(selectedDateKey);
    const selectedRows = filterOperationalRowsByDateKeyRange(rows, selectedDateKey, selectedDateKey);
    const monthRows = filterOperationalRowsByDateKeyRange(rows, window.monthStartKey, selectedDateKey);
    const trendRows = filterOperationalRowsByDateKeyRange(rows, window.trendStartKey, selectedDateKey);
    const selected = summarizeOperationalRows(selectedRows);
    const month = summarizeOperationalRows(monthRows);
    const dailyTrend = buildDailyMetrics(
        listDateKeys(window.trendStartKey, selectedDateKey),
        trendRows
    );

    const dailyVolumes = dailyTrend.map((day) => day.liters);
    const avgDailyVolume = dailyVolumes.length > 0
        ? dailyVolumes.reduce((sum, liters) => sum + liters, 0) / dailyVolumes.length
        : 0;
    const variance = dailyVolumes.length > 0
        ? dailyVolumes.reduce((sum, liters) => sum + Math.pow(liters - avgDailyVolume, 2), 0) / dailyVolumes.length
        : 0;
    const stdDevVolume = Math.sqrt(variance);
    const anomalies: FullDashboardAnomaly[] = [];

    if (
        selected.liters > 0
        && stdDevVolume > 0
        && Math.abs(selected.liters - avgDailyVolume) > 2 * stdDevVolume
    ) {
        anomalies.push({
            type: 'UNUSUAL_VOLUME',
            severity: selected.liters > avgDailyVolume ? 'WARNING' : 'CRITICAL',
            message: selected.liters > avgDailyVolume
                ? `ยอดขายวันที่เลือกสูงผิดปกติ (${selected.liters.toFixed(0)} L vs avg ${avgDailyVolume.toFixed(0)} L)`
                : `ยอดขายวันที่เลือกต่ำผิดปกติ (${selected.liters.toFixed(0)} L vs avg ${avgDailyVolume.toFixed(0)} L)`,
            date: selectedDateKey,
            details: { selectedLiters: selected.liters, avgDailyVolume, stdDevVolume },
        });
    }

    if (voidedCount > 0) {
        anomalies.push({
            type: 'VOIDED_TRANSACTIONS',
            severity: voidedCount >= 3 ? 'CRITICAL' : 'WARNING',
            message: `มีรายการยกเลิก ${voidedCount} รายการในวันที่เลือก`,
            date: selectedDateKey,
        });
    }

    const yesterday = dailyTrend.at(-2);
    if (yesterday && yesterday.liters > 0 && selected.liters > 0) {
        const dropPercent = ((yesterday.liters - selected.liters) / yesterday.liters) * 100;
        if (dropPercent > 50) {
            anomalies.push({
                type: 'SUDDEN_DROP',
                severity: dropPercent > 70 ? 'CRITICAL' : 'WARNING',
                message: `ยอดลดลง ${dropPercent.toFixed(0)}% เทียบกับวันก่อน`,
                date: selectedDateKey,
                details: { dropPercent, previousLiters: yesterday.liters, selectedLiters: selected.liters },
            });
        }
    }

    return {
        kpi: {
            today: {
                liters: selected.liters,
                revenue: selected.revenue,
                transactions: selected.transactions,
            },
            month: {
                liters: month.liters,
                revenue: month.revenue,
                transactions: month.transactions,
            },
        },
        dailyTrend,
        byFuelType: buildFuelTypeMetrics(selectedRows).map((fuel) => ({
            fuelType: fuel.fuelType || 'อื่นๆ',
            liters: fuel.liters,
            revenue: fuel.revenue,
            count: fuel.count,
        })),
        anomalies,
        stats: { avgDailyVolume, stdDevVolume },
        window,
    };
}
