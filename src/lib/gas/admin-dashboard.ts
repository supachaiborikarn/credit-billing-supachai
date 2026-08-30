import type { GasShiftAnalytics } from './admin-analytics';

export interface GasDashboardGaugeReading {
    tankNumber: number;
    percentage: number | string | null | undefined | { toString(): string };
}

function toNumber(value: GasDashboardGaugeReading['percentage']): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function moveGasDashboardDateKey(
    dateKey: string,
    values: { days?: number; months?: number }
): string {
    let [year, month, day] = dateKey.split('-').map(Number);
    const months = values.months ?? 0;

    if (months !== 0) {
        const monthIndex = year * 12 + (month - 1) + months;
        year = Math.floor(monthIndex / 12);
        month = ((monthIndex % 12) + 12) % 12 + 1;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        day = Math.min(day, lastDay);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (values.days) {
        date.setUTCDate(date.getUTCDate() + values.days);
    }
    return date.toISOString().slice(0, 10);
}

export function getGasDashboardDateWindow(todayKey: string) {
    return {
        todayKey,
        weekStartKey: moveGasDashboardDateKey(todayKey, { days: -6 }),
        monthStartKey: moveGasDashboardDateKey(todayKey, { months: -1 }),
    };
}

function sumSales(shifts: GasShiftAnalytics[]): number {
    return shifts.reduce((sum, shift) => sum + shift.sales.total, 0);
}

export function buildGasDashboardSalesSummary(
    shifts: GasShiftAnalytics[],
    window: ReturnType<typeof getGasDashboardDateWindow>
) {
    const today = shifts.filter((shift) => shift.dateKey === window.todayKey);
    const week = shifts.filter((shift) => shift.dateKey >= window.weekStartKey && shift.dateKey <= window.todayKey);
    const month = shifts.filter((shift) => shift.dateKey >= window.monthStartKey && shift.dateKey <= window.todayKey);

    return {
        todayTotal: sumSales(today),
        weekTotal: sumSales(week),
        monthTotal: sumSales(month),
        todayTransactions: today.reduce((sum, shift) => sum + shift.sales.transactions, 0),
        weekTransactions: week.reduce((sum, shift) => sum + shift.sales.transactions, 0),
        monthTransactions: month.reduce((sum, shift) => sum + shift.sales.transactions, 0),
        todayLiters: today.reduce((sum, shift) => sum + shift.sales.liters, 0),
        weekLiters: week.reduce((sum, shift) => sum + shift.sales.liters, 0),
        monthLiters: month.reduce((sum, shift) => sum + shift.sales.liters, 0),
    };
}

export function buildGasDashboardStationSummary(
    shifts: GasShiftAnalytics[],
    stationId: string,
    todayKey: string
) {
    const todayShifts = shifts.filter((shift) => (
        shift.stationId === stationId && shift.dateKey === todayKey
    ));
    const currentShift = todayShifts
        .filter((shift) => shift.status === 'OPEN' && !shift.isSyntheticOrphan)
        .sort((left, right) => right.shiftNumber - left.shiftNumber)[0] ?? null;

    return {
        currentShift: currentShift ? {
            shiftNumber: currentShift.shiftNumber,
            status: currentShift.status,
            staffName: currentShift.staffName,
        } : null,
        shiftsToday: todayShifts.filter((shift) => !shift.isSyntheticOrphan).length,
        todaySales: sumSales(todayShifts),
        todayLiters: todayShifts.reduce((sum, shift) => sum + shift.sales.liters, 0),
        todayTransactions: todayShifts.reduce((sum, shift) => sum + shift.sales.transactions, 0),
    };
}

export function buildLatestGaugeSummary(readings: GasDashboardGaugeReading[]) {
    const latestByTank = new Map<number, number>();
    for (const reading of readings) {
        if (reading.tankNumber < 1 || reading.tankNumber > 3 || latestByTank.has(reading.tankNumber)) continue;
        const percentage = toNumber(reading.percentage);
        if (percentage === null) continue;
        latestByTank.set(reading.tankNumber, percentage);
    }

    const percentages = [...latestByTank.values()];
    return {
        tankCount: percentages.length,
        average: percentages.length > 0
            ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
            : null,
        hasLowTank: percentages.some((value) => value < 20),
    };
}
