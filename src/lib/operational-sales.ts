import { prisma } from '@/lib/prisma';
import { formatDateBangkok, getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { STATION_STAFF } from '@/constants';
import { isMissingWatcharaExternalTablesError } from '@/lib/watchara-dispenser-sync';
import {
    WATCHARA_DISPENSER_SOURCE_CODE,
    WATCHARA_FUEL_FAMILY,
    WATCHARA_LOCAL_STATION_ID,
    getWatcharaDispenserStaleInfo,
} from '@/lib/watchara-dispenser-utils';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

type OperationalSaleSource = 'internal' | 'watchara_external';

export interface OperationalSaleRow {
    source: OperationalSaleSource;
    stationId: string;
    dateKey: string;
    soldAt: Date;
    liters: number;
    revenue: number;
    paymentType: string | null;
    pricePerLiter: number | null;
    billBookNo: string | null;
    billNo: string | null;
    nozzleNumber: number | null;
    fuelType: string;
    ownerId: string | null;
    ownerName: string | null;
}

export interface OperationalMetrics {
    liters: number;
    revenue: number;
    transactions: number;
}

export interface WatcharaExternalMergeStatus {
    schemaReady: boolean;
    available: boolean;
    enabled: boolean;
    targetStationIncluded: boolean;
    includedInMerge: boolean;
    rowsInRange: number;
    litersInRange: number;
    revenueInRange: number;
    lastSyncedAt: string | null;
    lastSeenSourceAt: string | null;
    lastError: string | null;
    stale: {
        isStale: boolean;
        staleHours: number | null;
        thresholdHours: number;
    };
}

export interface OperationalSalesDataset {
    rows: OperationalSaleRow[];
    watcharaExternal: WatcharaExternalMergeStatus;
}

export interface OperationalPaymentTotals {
    cash: number;
    credit: number;
    transfer: number;
    card: number;
    boxTruck: number;
    oilTruckSupachai: number;
    other: number;
    total: number;
}

export interface WatcharaExternalDailySummary {
    rows: OperationalSaleRow[];
    summary: OperationalMetrics;
    payments: OperationalPaymentTotals;
    watcharaExternal: WatcharaExternalMergeStatus;
}

function parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatUtcDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

function toUtcDateOnly(dateKey: string): Date {
    return parseDateKey(dateKey);
}

function toBangkokHour(date: Date): number {
    return new Date(date.getTime() + BANGKOK_OFFSET_MS).getUTCHours();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
    const next = parseDateKey(dateKey);
    next.setUTCDate(next.getUTCDate() + days);
    return formatUtcDateKey(next);
}

export function getMonthStartDateKey(dateKey: string): string {
    const date = parseDateKey(dateKey);
    return formatUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

export function getMonthEndDateKey(dateKey: string): string {
    const date = parseDateKey(dateKey);
    return formatUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

export function listDateKeys(startDateKey: string, endDateKey: string): string[] {
    const dates: string[] = [];
    let current = startDateKey;

    while (current <= endDateKey) {
        dates.push(current);
        current = addDaysToDateKey(current, 1);
    }

    return dates;
}

export function normalizeOperationalFuelType(productType?: string | null, fuelFamily?: string | null): string {
    const raw = (productType || fuelFamily || '').trim();
    if (!raw) return 'อื่นๆ';

    const key = raw.toLowerCase();

    if (['diesel', 'diesel b7', 'ดีเซล', 'ดีเซล b7', 'น้ำมันดีเซล'].includes(key)) {
        return 'ดีเซล';
    }

    if (['power_diesel', 'power diesel', 'พาวเวอร์ดีเซล'].includes(key)) {
        return 'พาวเวอร์ดีเซล';
    }

    if (['gasohol_91', 'เบนซิน91', 'เบนซิน 91', 'แก๊สโซฮอล์ 91'].includes(key)) {
        return 'เบนซิน91';
    }

    if (['gasohol_95', 'เบนซิน95', 'เบนซิน 95', 'แก๊สโซฮอล์ 95'].includes(key)) {
        return 'เบนซิน95';
    }

    if (['gasohol_e20', 'e20', 'แก๊สโซฮอล์ e20'].includes(key)) {
        return 'E20';
    }

    if (['benzin_95'].includes(key)) {
        return 'เบนซิน95';
    }

    if (key === 'lpg') {
        return 'LPG';
    }

    return raw;
}

export function createEmptyMetrics(): OperationalMetrics {
    return {
        liters: 0,
        revenue: 0,
        transactions: 0,
    };
}

export function createEmptyPaymentTotals(): OperationalPaymentTotals {
    return {
        cash: 0,
        credit: 0,
        transfer: 0,
        card: 0,
        boxTruck: 0,
        oilTruckSupachai: 0,
        other: 0,
        total: 0,
    };
}

function accumulateMetrics(target: OperationalMetrics, row: Pick<OperationalSaleRow, 'liters' | 'revenue'>) {
    target.liters += row.liters;
    target.revenue += row.revenue;
    target.transactions += 1;
}

export function filterOperationalRowsByDateKeyRange(
    rows: OperationalSaleRow[],
    startDateKey: string,
    endDateKey: string
): OperationalSaleRow[] {
    return rows.filter((row) => row.dateKey >= startDateKey && row.dateKey <= endDateKey);
}

export function summarizeOperationalRows(rows: OperationalSaleRow[]): OperationalMetrics {
    const summary = createEmptyMetrics();

    rows.forEach((row) => accumulateMetrics(summary, row));

    return summary;
}

export function summarizeOperationalPayments(rows: OperationalSaleRow[]): OperationalPaymentTotals {
    const totals = createEmptyPaymentTotals();

    rows.forEach((row) => {
        totals.total += row.revenue;

        switch (row.paymentType) {
            case 'CASH':
                totals.cash += row.revenue;
                break;
            case 'CREDIT':
                totals.credit += row.revenue;
                break;
            case 'TRANSFER':
                totals.transfer += row.revenue;
                break;
            case 'CREDIT_CARD':
                totals.card += row.revenue;
                break;
            case 'BOX_TRUCK':
                totals.boxTruck += row.revenue;
                break;
            case 'OIL_TRUCK_SUPACHAI':
                totals.oilTruckSupachai += row.revenue;
                break;
            default:
                totals.other += row.revenue;
                break;
        }
    });

    return totals;
}

export function buildDailyMetrics(dateKeys: string[], rows: OperationalSaleRow[]) {
    const byDate = new Map<string, OperationalMetrics>();

    dateKeys.forEach((dateKey) => {
        byDate.set(dateKey, createEmptyMetrics());
    });

    rows.forEach((row) => {
        const bucket = byDate.get(row.dateKey);
        if (bucket) {
            accumulateMetrics(bucket, row);
        }
    });

    return dateKeys.map((dateKey) => ({
        date: dateKey,
        liters: byDate.get(dateKey)?.liters || 0,
        revenue: byDate.get(dateKey)?.revenue || 0,
        count: byDate.get(dateKey)?.transactions || 0,
    }));
}

export function buildFuelTypeMetrics(rows: OperationalSaleRow[]) {
    const byFuel = new Map<string, OperationalMetrics>();

    rows.forEach((row) => {
        const bucket = byFuel.get(row.fuelType) || createEmptyMetrics();
        accumulateMetrics(bucket, row);
        byFuel.set(row.fuelType, bucket);
    });

    return Array.from(byFuel.entries()).map(([fuelType, metrics]) => ({
        fuelType,
        liters: metrics.liters,
        revenue: metrics.revenue,
        count: metrics.transactions,
    }));
}

export function buildHourlyMetrics(rows: OperationalSaleRow[]) {
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        liters: 0,
        revenue: 0,
        count: 0,
    }));

    rows.forEach((row) => {
        const hour = toBangkokHour(row.soldAt);
        hourly[hour].liters += row.liters;
        hourly[hour].revenue += row.revenue;
        hourly[hour].count += 1;
    });

    return hourly;
}

export function buildNozzleMetrics(rows: OperationalSaleRow[]) {
    const byNozzle = new Map<number, OperationalMetrics>();

    rows.forEach((row) => {
        if (row.nozzleNumber === null) return;

        const bucket = byNozzle.get(row.nozzleNumber) || createEmptyMetrics();
        accumulateMetrics(bucket, row);
        byNozzle.set(row.nozzleNumber, bucket);
    });

    return Array.from(byNozzle.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([nozzle, metrics]) => ({
            nozzle,
            liters: metrics.liters,
            revenue: metrics.revenue,
            count: metrics.transactions,
        }));
}

export function buildStationDailyMatrix(dateKeys: string[], stationIds: string[], rows: OperationalSaleRow[]) {
    const matrix: Record<string, Record<string, OperationalMetrics>> = {};

    dateKeys.forEach((dateKey) => {
        matrix[dateKey] = {};
        stationIds.forEach((stationId) => {
            matrix[dateKey][stationId] = createEmptyMetrics();
        });
    });

    rows.forEach((row) => {
        const dateBucket = matrix[row.dateKey];
        if (!dateBucket || !dateBucket[row.stationId]) return;

        accumulateMetrics(dateBucket[row.stationId], row);
    });

    return matrix;
}

export async function getOperationalSalesDataset({
    stationIds,
    startDateKey,
    endDateKey,
}: {
    stationIds: string[];
    startDateKey: string;
    endDateKey: string;
}): Promise<OperationalSalesDataset> {
    const targetStationIncluded = stationIds.includes(WATCHARA_LOCAL_STATION_ID);
    const internalStartAt = getStartOfDayBangkok(startDateKey);
    const internalEndAt = getEndOfDayBangkok(endDateKey);
    const externalStartDate = toUtcDateOnly(startDateKey);
    const externalEndDate = toUtcDateOnly(endDateKey);

    const internalRows = await prisma.transaction.findMany({
        where: {
            stationId: { in: stationIds },
            date: { gte: internalStartAt, lte: internalEndAt },
            isVoided: false,
            deletedAt: null,
        },
        select: {
            stationId: true,
            date: true,
            liters: true,
            amount: true,
            paymentType: true,
            pricePerLiter: true,
            billBookNo: true,
            billNo: true,
            nozzleNumber: true,
            productType: true,
            ownerId: true,
            ownerName: true,
        },
    });

    let schemaReady = true;
    let source: {
        isEnabled: boolean;
        lastSyncedAt: Date | null;
        lastSeenSourceAt: Date | null;
        lastError: string | null;
    } | null = null;
    let externalRows: Array<{
        soldAt: Date;
        businessDate: Date;
        liters: unknown;
        amountBaht: unknown;
        paymentType: string | null;
        pricePerLiter: unknown;
        billNo: string | null;
        nozzleNumber: number | null;
        productLabel: string | null;
        fuelFamily: string;
    }> = [];

    if (targetStationIncluded) {
        try {
            source = await prisma.externalSalesSource.findUnique({
                where: { code: WATCHARA_DISPENSER_SOURCE_CODE },
                select: {
                    isEnabled: true,
                    lastSyncedAt: true,
                    lastSeenSourceAt: true,
                    lastError: true,
                },
            });

            if (source?.isEnabled) {
                externalRows = await prisma.externalDispenserTransaction.findMany({
                    where: {
                        stationId: WATCHARA_LOCAL_STATION_ID,
                        businessDate: { gte: externalStartDate, lte: externalEndDate },
                        isVoided: false,
                        isDeleted: false,
                        fuelFamily: WATCHARA_FUEL_FAMILY,
                        source: {
                            code: WATCHARA_DISPENSER_SOURCE_CODE,
                            isEnabled: true,
                        },
                    },
                    select: {
                        soldAt: true,
                        businessDate: true,
                        liters: true,
                        amountBaht: true,
                        paymentType: true,
                        pricePerLiter: true,
                        billNo: true,
                        nozzleNumber: true,
                        productLabel: true,
                        fuelFamily: true,
                    },
                });
            }
        } catch (error) {
            if (isMissingWatcharaExternalTablesError(error)) {
                schemaReady = false;
                source = null;
                externalRows = [];
            } else {
                throw error;
            }
        }
    }

    const mergedRows: OperationalSaleRow[] = [
        ...internalRows.map((row) => ({
            source: 'internal' as const,
            stationId: row.stationId,
            dateKey: formatDateBangkok(row.date),
            soldAt: row.date,
            liters: Number(row.liters) || 0,
            revenue: Number(row.amount) || 0,
            paymentType: row.paymentType,
            pricePerLiter: Number(row.pricePerLiter) || 0,
            billBookNo: row.billBookNo,
            billNo: row.billNo,
            nozzleNumber: row.nozzleNumber,
            fuelType: normalizeOperationalFuelType(row.productType),
            ownerId: row.ownerId,
            ownerName: row.ownerName,
        })),
        ...externalRows.map((row) => ({
            source: 'watchara_external' as const,
            stationId: WATCHARA_LOCAL_STATION_ID,
            dateKey: formatUtcDateKey(row.businessDate),
            soldAt: row.soldAt,
            liters: Number(row.liters) || 0,
            revenue: Number(row.amountBaht) || 0,
            paymentType: row.paymentType,
            pricePerLiter: row.pricePerLiter === null ? null : Number(row.pricePerLiter),
            billBookNo: null,
            billNo: row.billNo,
            nozzleNumber: row.nozzleNumber,
            fuelType: normalizeOperationalFuelType(row.productLabel, row.fuelFamily),
            ownerId: null,
            ownerName: null,
        })),
    ];

    const externalSummary = summarizeOperationalRows(
        mergedRows.filter((row) => row.source === 'watchara_external')
    );

    return {
        rows: mergedRows,
        watcharaExternal: {
            schemaReady,
            available: Boolean(source),
            enabled: Boolean(source?.isEnabled),
            targetStationIncluded,
            includedInMerge: targetStationIncluded && schemaReady && Boolean(source?.isEnabled),
            rowsInRange: externalSummary.transactions,
            litersInRange: externalSummary.liters,
            revenueInRange: externalSummary.revenue,
            lastSyncedAt: source?.lastSyncedAt?.toISOString() || null,
            lastSeenSourceAt: source?.lastSeenSourceAt?.toISOString() || null,
            lastError: source?.lastError || null,
            stale: getWatcharaDispenserStaleInfo(source?.lastSeenSourceAt || null),
        },
    };
}

export async function getWatcharaExternalDailySummary({
    stationId,
    dateKey,
}: {
    stationId: string;
    dateKey: string;
}): Promise<WatcharaExternalDailySummary> {
    const dataset = await getOperationalSalesDataset({
        stationIds: [stationId],
        startDateKey: dateKey,
        endDateKey: dateKey,
    });
    const rows = filterOperationalRowsByDateKeyRange(dataset.rows, dateKey, dateKey)
        .filter((row) => row.source === 'watchara_external');

    return {
        rows,
        summary: summarizeOperationalRows(rows),
        payments: summarizeOperationalPayments(rows),
        watcharaExternal: dataset.watcharaExternal,
    };
}

export async function shouldApplyWatcharaExternalToShift({
    stationId,
    dailyRecordId,
    shiftNumber,
    dateKey,
}: {
    stationId: string;
    dailyRecordId: string;
    shiftNumber: number;
    dateKey: string;
}): Promise<boolean> {
    if (stationId !== WATCHARA_LOCAL_STATION_ID) {
        return false;
    }

    const configuredMaxShifts = STATION_STAFF[stationId as keyof typeof STATION_STAFF]?.maxShifts;
    if (configuredMaxShifts && shiftNumber >= configuredMaxShifts) {
        return true;
    }

    if (dateKey >= getTodayBangkok()) {
        return false;
    }

    const hasHigherShift = await prisma.shift.findFirst({
        where: {
            dailyRecordId,
            shiftNumber: { gt: shiftNumber },
        },
        select: { id: true },
    });

    return !hasHigherShift;
}
