import { formatDateBangkok, getStartOfDayBangkok } from '@/lib/date-utils';
import type { StationHistoryAttentionReason } from '@/types/station-history';

const MAX_HISTORY_DAYS = 93;
const DEFAULT_HISTORY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HistoryGaugeRow {
    tankNumber: number;
    percentage: number | string | { toString(): string };
    photoUrl: string | null;
    shiftNumber: number | null;
    notes: string | null;
    createdAt: Date | string;
}

export function isDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

export function getStationHistoryRange(options: {
    from?: string | null;
    to?: string | null;
    today: string;
}) {
    const to = options.to || options.today;
    if (!isDateKey(to)) throw new Error('วันที่สิ้นสุดไม่ถูกต้อง');

    const defaultFrom = formatDateBangkok(
        new Date(getStartOfDayBangkok(to).getTime() - (DEFAULT_HISTORY_DAYS - 1) * DAY_MS)
    );
    const from = options.from || defaultFrom;
    if (!isDateKey(from)) throw new Error('วันที่เริ่มต้นไม่ถูกต้อง');

    const fromTime = getStartOfDayBangkok(from).getTime();
    const toTime = getStartOfDayBangkok(to).getTime();
    if (fromTime > toTime) throw new Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');

    const days = Math.floor((toTime - fromTime) / DAY_MS) + 1;
    if (days > MAX_HISTORY_DAYS) {
        throw new Error(`ดูประวัติได้ครั้งละไม่เกิน ${MAX_HISTORY_DAYS} วัน`);
    }

    return { from, to, days };
}

function latestGauge(rows: HistoryGaugeRow[]) {
    return [...rows].sort((left, right) => (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ))[0];
}

export function buildShiftGaugeHistory(rows: HistoryGaugeRow[], shiftNumber: number) {
    return [1, 2, 3].map((tankNumber) => {
        const tankRows = rows.filter((row) => row.shiftNumber === shiftNumber && row.tankNumber === tankNumber);
        const start = latestGauge(tankRows.filter((row) => row.notes !== 'end'));
        const end = latestGauge(tankRows.filter((row) => row.notes === 'end'));
        return {
            tankNumber,
            startPercentage: start ? Number(start.percentage) : null,
            endPercentage: end ? Number(end.percentage) : null,
            startPhoto: start?.photoUrl || null,
            endPhoto: end?.photoUrl || null,
        };
    }).filter((gauge) => gauge.startPercentage !== null || gauge.endPercentage !== null);
}

export function getHistoryAttentionReasons(options: {
    status: string;
    anomalyCount: number;
    dailyAnomaly: boolean;
    varianceStatus?: string | null;
}): StationHistoryAttentionReason[] {
    const reasons: StationHistoryAttentionReason[] = [];
    if (options.status === 'OPEN') reasons.push('OPEN_SHIFT');
    if (options.anomalyCount > 0) reasons.push('METER_ANOMALY');
    if (options.dailyAnomaly) reasons.push('DAILY_ANOMALY');
    if (options.varianceStatus && options.varianceStatus !== 'GREEN') {
        reasons.push('RECONCILIATION_VARIANCE');
    }
    return reasons;
}

export function normalizeHistoryVariance(totalExpected: unknown, totalReceived: unknown): number {
    const expected = Number(totalExpected);
    const received = Number(totalReceived);
    if (!Number.isFinite(expected) || !Number.isFinite(received)) return 0;
    return Number((received - expected).toFixed(2));
}

export function normalizeMeterTransactionDifferenceLiters(totalMeterLiters: unknown, transactionLiters: unknown): number {
    const meter = Number(totalMeterLiters);
    const transactions = Number(transactionLiters);
    if (!Number.isFinite(meter) || !Number.isFinite(transactions)) return 0;
    return Number((meter - transactions).toFixed(3));
}
