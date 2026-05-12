import { NextResponse } from 'next/server';
import {
    GAS_TANK_CAPACITY_LITERS,
    STATIONS,
} from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    buildGasStaffPerformance,
    buildGasNozzlePerformance,
    buildGasDailyAnalytics,
    getGasAnalyticsStationIds,
    getGasShiftAnalyticsData,
} from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';
import { prisma } from '@/lib/prisma';

function moveBangkokDateKey(
    dateKey: string,
    values: { days?: number; months?: number }
): string {
    const date = getStartOfDayBangkokUTC(dateKey);

    if (values.days) {
        date.setUTCDate(date.getUTCDate() + values.days);
    }

    if (values.months) {
        date.setUTCMonth(date.getUTCMonth() + values.months);
    }

    return toBangkokDateKey(date);
}

function sumBy<T>(items: T[], picker: (item: T) => number): number {
    return items.reduce((sum, item) => sum + picker(item), 0);
}

function buildDateSeries(fromKey: string, toKey: string): string[] {
    const result: string[] = [];
    let current = fromKey;

    while (current <= toKey) {
        result.push(current);
        current = moveBangkokDateKey(current, { days: 1 });
    }

    return result;
}

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

function getAlertSeverity(value: number, thresholds: { warning: number; critical: number }): AlertSeverity {
    if (value >= thresholds.critical) return 'CRITICAL';
    if (value >= thresholds.warning) return 'WARNING';
    return 'INFO';
}

// GET: Executive Dashboard data
export async function GET() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const gasStations = STATIONS
            .filter((station) => station.type === 'GAS')
            .map((station) => ({
                id: station.id,
                name: station.name,
            }));

        const todayKey = getGasBusinessDateKey();
        const weekStartKey = moveBangkokDateKey(todayKey, { days: -6 });
        const monthStartKey = moveBangkokDateKey(todayKey, { months: -1 });

        const shiftFacts = await getGasShiftAnalyticsData({
            fromDate: getStartOfDayBangkokUTC(monthStartKey),
            toDate: getEndOfDayBangkokUTC(todayKey),
        });

        const dailyFacts = buildGasDailyAnalytics(shiftFacts);
        const dailyFactByKey = new Map(dailyFacts.map((day) => [day.dateKey, day]));
        const todaySummary = dailyFactByKey.get(todayKey);
        const weekSummaries = dailyFacts.filter((day) => day.dateKey >= weekStartKey);
        const monthSummaries = dailyFacts.filter((day) => day.dateKey >= monthStartKey);
        const weekShiftFacts = shiftFacts.filter((shift) => shift.dateKey >= weekStartKey);

        const salesTrend = buildDateSeries(weekStartKey, todayKey).map((dateKey) => ({
            date: dateKey,
            amount: dailyFactByKey.get(dateKey)?.totalSales || 0,
        }));

        const stationComparison = gasStations.map((station) => {
            const todayShifts = shiftFacts.filter((shift) => (
                shift.stationId === station.id
                && shift.dateKey === todayKey
            ));

            const todaySales = sumBy(todayShifts, (shift) => shift.sales.total);
            const todayReceived = sumBy(todayShifts, (shift) => (
                shift.reconciliation?.received ?? shift.sales.total
            ));
            const todayLiters = sumBy(todayShifts, (shift) => shift.sales.liters);
            const todayTransactions = sumBy(todayShifts, (shift) => shift.sales.transactions);
            const todayVariance = sumBy(todayShifts, (shift) => shift.reconciliation?.variance ?? 0);

            return {
                id: station.id,
                name: station.name,
                todaySales,
                todayReceived,
                todayLiters,
                todayTransactions,
                averageTicket: todayTransactions > 0
                    ? Number((todaySales / todayTransactions).toFixed(2))
                    : 0,
                todayVariance,
            };
        });

        const shiftsData = gasStations.map((station) => ({
            stationName: station.name,
            shifts: shiftFacts
                .filter((shift) => shift.stationId === station.id && shift.dateKey === todayKey)
                .map((shift) => ({
                    shiftNumber: shift.shiftNumber,
                    status: shift.status,
                    staffName: shift.staffName || '-',
                    totalSales: shift.sales.total,
                    transactionCount: shift.sales.transactions,
                    liters: shift.sales.liters,
                    variance: shift.reconciliation?.variance ?? 0,
                    varianceStatus: shift.reconciliation?.varianceStatus ?? 'BALANCED',
                })),
        }));

        const inventory = await Promise.all(
            gasStations.map(async (station) => {
                const stationIds = getGasAnalyticsStationIds(station.id);
                const gauges = await prisma.gaugeReading.findMany({
                    where: {
                        stationId: { in: stationIds },
                    },
                    orderBy: [
                        { tankNumber: 'asc' },
                        { date: 'desc' },
                    ],
                });

                const latestByTank = new Map<number, number>();
                for (const gauge of gauges) {
                    if (!latestByTank.has(gauge.tankNumber)) {
                        latestByTank.set(gauge.tankNumber, Number(gauge.percentage));
                    }
                }

                const tanks = [1, 2, 3].map((tankNumber) => (
                    latestByTank.has(tankNumber) ? latestByTank.get(tankNumber)! : null
                ));

                const validTanks = tanks.filter((value): value is number => value !== null);
                const average = validTanks.length > 0
                    ? validTanks.reduce((sum, value) => sum + value, 0) / validTanks.length
                    : null;
                const litersRemaining = validTanks.length > 0
                    ? Number(validTanks.reduce((sum, value) => (
                        sum + (value / 100) * GAS_TANK_CAPACITY_LITERS
                    ), 0).toFixed(2))
                    : 0;

                const stationWeekSummaries = weekSummaries
                    .map((day) => day.stationBreakdown.find((item) => item.stationId === station.id))
                    .filter((item): item is NonNullable<typeof item> => Boolean(item));

                const weekAverageLiters = stationWeekSummaries.length > 0
                    ? Number((
                        sumBy(stationWeekSummaries, (item) => item.totalLiters)
                        / stationWeekSummaries.length
                    ).toFixed(2))
                    : 0;
                const daysToEmpty = weekAverageLiters > 0
                    ? Number((litersRemaining / weekAverageLiters).toFixed(2))
                    : null;
                const runoutSeverity = daysToEmpty === null
                    ? 'INFO'
                    : getAlertSeverity(
                        daysToEmpty <= 1 ? 2 : daysToEmpty <= 3 ? 1 : 0,
                        { warning: 1, critical: 2 }
                    );

                const todayStation = stationComparison.find((item) => item.id === station.id);

                return {
                    stationName: station.name,
                    tanks,
                    average,
                    isLow: average !== null && average < 20,
                    litersRemaining,
                    todayLiters: todayStation?.todayLiters || 0,
                    weekAverageLiters,
                    daysToEmpty,
                    runoutSeverity,
                };
            })
        );

        const staffPerformance = buildGasStaffPerformance(weekShiftFacts).slice(0, 5);
        const nozzlePerformance = buildGasNozzlePerformance(weekShiftFacts).slice(0, 6);

        const todayAverageSales = weekSummaries.length > 0
            ? sumBy(weekSummaries, (day) => day.totalSales) / weekSummaries.length
            : 0;
        const todayAverageCreditShare = weekSummaries.length > 0
            ? sumBy(weekSummaries, (day) => (
                day.totalSales > 0 ? day.creditAmount / day.totalSales : 0
            )) / weekSummaries.length
            : 0;

        const repeatedVarianceStations = gasStations
            .map((station) => {
                const riskyShifts = weekShiftFacts.filter((shift) => (
                    shift.stationId === station.id
                    && (shift.reconciliation?.varianceSeverity === 'RED'
                        || shift.reconciliation?.varianceSeverity === 'YELLOW')
                ));

                return {
                    stationName: station.name,
                    count: riskyShifts.length,
                    worstVariance: riskyShifts.reduce((worst, shift) => {
                        const variance = Math.abs(shift.reconciliation?.variance ?? 0);
                        return Math.max(worst, variance);
                    }, 0),
                };
            })
            .filter((station) => station.count >= 2);

        const todayCreditShare = todaySummary && todaySummary.totalSales > 0
            ? todaySummary.creditAmount / todaySummary.totalSales
            : 0;

        const alerts = [
            ...inventory
                .filter((item) => item.daysToEmpty !== null && item.daysToEmpty <= 3)
                .map((item) => ({
                    id: `runout:${item.stationName}`,
                    severity: item.daysToEmpty !== null && item.daysToEmpty <= 1 ? 'CRITICAL' as const : 'WARNING' as const,
                    title: `${item.stationName} ใกล้หมดถัง`,
                    detail: `เหลือประมาณ ${item.litersRemaining.toLocaleString()} ลิตร ใช้ได้อีก ${item.daysToEmpty?.toFixed(1)} วัน`,
                })),
            ...repeatedVarianceStations.map((station) => ({
                id: `variance:${station.stationName}`,
                severity: station.count >= 3 ? 'CRITICAL' as const : 'WARNING' as const,
                title: `${station.stationName} มียอดต่างซ้ำ`,
                detail: `${station.count} กะใน 7 วันล่าสุด มียอดต่างสูงสุด ฿${station.worstVariance.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            })),
            ...(todaySummary && todayAverageSales > 0 && todaySummary.totalSales < todayAverageSales * 0.7
                ? [{
                    id: 'sales-drop',
                    severity: 'WARNING' as const,
                    title: 'ยอดขายวันนี้ต่ำกว่าค่าเฉลี่ย',
                    detail: `วันนี้ ฿${todaySummary.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} เทียบค่าเฉลี่ย 7 วัน ฿${todayAverageSales.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                }]
                : []),
            ...(todaySummary && todayAverageCreditShare > 0.01 && todayCreditShare > todayAverageCreditShare * 1.5
                ? [{
                    id: 'credit-spike',
                    severity: 'INFO' as const,
                    title: 'สัดส่วนเงินเชื่อวันนี้สูงผิดปกติ',
                    detail: `วันนี้ ${(todayCreditShare * 100).toFixed(1)}% เทียบเฉลี่ย 7 วัน ${(todayAverageCreditShare * 100).toFixed(1)}%`,
                }]
                : []),
            ...weekShiftFacts
                .filter((shift) => shift.meters.continuity.issueCount > 0)
                .slice(0, 3)
                .map((shift) => ({
                    id: `meter-continuity:${shift.id}`,
                    severity: Math.abs(shift.meters.continuity.maxGap) >= 5 ? 'CRITICAL' as const : 'WARNING' as const,
                    title: `${shift.stationName} มิเตอร์ไม่ต่อกัน`,
                    detail: `${shift.displayDate} กะ ${shift.shiftNumber} พบ ${shift.meters.continuity.issueCount} หัวจ่ายไม่ต่อจากกะก่อน (ต่างสูงสุด ${shift.meters.continuity.maxGap >= 0 ? '+' : ''}${shift.meters.continuity.maxGap.toLocaleString()} L)`,
                })),
            ...weekShiftFacts
                .filter((shift) => Math.abs(shift.meters.litersVariance) >= 5)
                .slice(0, 3)
                .map((shift) => ({
                    id: `liters:${shift.id}`,
                    severity: Math.abs(shift.meters.litersVariance) >= 10 ? 'CRITICAL' as const : 'WARNING' as const,
                    title: `${shift.stationName} กะ ${shift.shiftNumber} ลิตรต่าง`,
                    detail: `${shift.displayDate} ต่าง ${shift.meters.litersVariance >= 0 ? '+' : ''}${shift.meters.litersVariance.toLocaleString()} ลิตร`,
                })),
        ]
            .sort((left, right) => {
                const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
                return order[left.severity] - order[right.severity];
            })
            .slice(0, 8);

        const ownersWithCredit = await prisma.owner.findMany({
            where: {
                currentCredit: { gt: 0 },
                deletedAt: null,
            },
            orderBy: { currentCredit: 'desc' },
            take: 5,
            select: {
                id: true,
                name: true,
                currentCredit: true,
                creditLimit: true,
            },
        });

        const totalAR = await prisma.owner.aggregate({
            where: { deletedAt: null },
            _sum: { currentCredit: true },
        });

        const recentAnomalies = await prisma.meterAnomaly.findMany({
            where: { reviewedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                shift: {
                    include: {
                        dailyRecord: { select: { stationId: true, date: true } },
                    },
                },
            },
        });

        const anomalies = recentAnomalies.map((anomaly) => ({
            id: anomaly.id,
            nozzle: anomaly.nozzleNumber,
            severity: anomaly.severity,
            percentDiff: Number(anomaly.percentDiff),
            date: anomaly.shift.dailyRecord.date,
            stationId: anomaly.shift.dailyRecord.stationId,
        }));

        return NextResponse.json({
            financial: {
                todaySales: todaySummary?.totalSales || 0,
                todayReceived: todaySummary?.totalReceived || 0,
                todayVariance: todaySummary?.variance || 0,
                todayLiters: todaySummary?.totalLiters || 0,
                todayTransactions: todaySummary?.transactionCount || 0,
                averageTicketToday: todaySummary?.averageTicket || 0,
                weekSales: sumBy(weekSummaries, (day) => day.totalSales),
                monthSales: sumBy(monthSummaries, (day) => day.totalSales),
                salesTrend,
                paymentMixToday: {
                    cash: todaySummary?.cashAmount || 0,
                    credit: todaySummary?.creditAmount || 0,
                    card: todaySummary?.cardAmount || 0,
                    transfer: todaySummary?.transferAmount || 0,
                },
                stationComparison,
            },
            operations: {
                shifts: shiftsData,
            },
            inventory: {
                gauges: inventory,
                lowStockCount: inventory.filter((item) => item.isLow).length,
            },
            performance: {
                staff: staffPerformance,
                nozzles: nozzlePerformance,
                alerts,
            },
            ar: {
                totalOutstanding: Number(totalAR._sum.currentCredit) || 0,
                topDebtors: ownersWithCredit.map((owner) => ({
                    id: owner.id,
                    name: owner.name,
                    amount: Number(owner.currentCredit),
                    limit: Number(owner.creditLimit),
                })),
            },
            audit: {
                unreviewedAnomalies: anomalies.length,
                recentAnomalies: anomalies,
            },
        });
    } catch (error) {
        console.error('Error fetching executive dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
