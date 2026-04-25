import { DEFAULT_GAS_PRICE, STATIONS } from '@/constants';
import { prisma } from '@/lib/prisma';
import {
    addToGasPaymentSummary,
} from '@/lib/gas/payment-utils';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';

type NumericLike = number | string | null | undefined | { toString(): string };

type AnalyticsMeterRecord = {
    nozzleNumber: number;
    startReading: NumericLike;
    endReading: NumericLike;
    soldQty: NumericLike;
};

type AnalyticsReconciliationRecord = {
    expectedFuelAmount: NumericLike;
    expectedOtherAmount: NumericLike;
    totalExpected: NumericLike;
    totalReceived: NumericLike;
    cashReceived: NumericLike;
    creditReceived: NumericLike;
    transferReceived: NumericLike;
    variance: NumericLike;
    varianceStatus: string;
};

type AnalyticsShiftRecord = {
    id: string;
    shiftNumber: number;
    status: string;
    createdAt: Date;
    closedAt: Date | null;
    varianceNote: string | null;
    staff: { name: string | null } | null;
    dailyRecord: {
        id: string;
        stationId: string;
        date: Date;
        gasPrice: NumericLike;
        station: { name: string | null } | null;
    };
    meters: AnalyticsMeterRecord[];
    reconciliation: AnalyticsReconciliationRecord | null;
};

type AnalyticsTransactionRecord = {
    id: string;
    stationId: string;
    dailyRecordId: string | null;
    shiftId: string | null;
    date: Date;
    paymentType: string;
    liters: NumericLike;
    amount: NumericLike;
};

export interface GasPaymentBreakdown {
    cash: number;
    credit: number;
    card: number;
    transfer: number;
}

export interface GasShiftAnalytics {
    id: string;
    stationId: string;
    stationName: string;
    rawStationId: string;
    dateKey: string;
    displayDate: string;
    shiftNumber: number;
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    status: string;
    isSyntheticOrphan?: boolean;
    gasPrice: number;
    transactionCount: number;
    meters: {
        total: number;
        transactionLiters: number;
        litersVariance: number;
        nozzles: {
            nozzleNumber: number;
            startReading: number;
            endReading: number;
            soldQty: number;
        }[];
    };
    sales: {
        total: number;
        liters: number;
        transactions: number;
        cash: number;
        credit: number;
        card: number;
        transfer: number;
        averageTicket: number;
        expectedPayments: GasPaymentBreakdown;
    };
    reconciliation: {
        hasRecord: boolean;
        expected: number;
        received: number;
        variance: number;
        varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
        varianceSeverity: 'GREEN' | 'YELLOW' | 'RED';
        cashExpected: number;
        cashReceived: number;
        creditExpected: number;
        creditReceived: number;
        cardExpected: number;
        cardReceived: number;
        transferExpected: number;
        transferReceived: number;
        varianceNote: string | null;
    } | null;
}

export interface GasDailyAnalytics {
    dateKey: string;
    displayDate: string;
    totalSales: number;
    totalReceived: number;
    totalLiters: number;
    meterLiters: number;
    transactionLiters: number;
    litersVariance: number;
    transactionCount: number;
    shiftCount: number;
    cashAmount: number;
    creditAmount: number;
    cardAmount: number;
    transferAmount: number;
    averageTicket: number;
    variance: number;
    stationBreakdown: Array<{
        stationId: string;
        stationName: string;
        totalSales: number;
        totalReceived: number;
        totalLiters: number;
        meterLiters: number;
        transactionLiters: number;
        litersVariance: number;
        transactionCount: number;
        shiftCount: number;
        cashAmount: number;
        creditAmount: number;
        cardAmount: number;
        transferAmount: number;
        variance: number;
        averageTicket: number;
    }>;
}

export interface GasStaffPerformance {
    staffName: string;
    shiftCount: number;
    stationCount: number;
    totalSales: number;
    totalLiters: number;
    transactionCount: number;
    averageTicket: number;
    averageLitersPerShift: number;
    averageVariance: number;
    stations: string[];
}

export interface GasNozzlePerformance {
    stationId: string;
    stationName: string;
    nozzleNumber: number;
    shiftCount: number;
    totalLiters: number;
    averageLitersPerShift: number;
    estimatedSales: number;
}

interface GasStationMeta {
    canonicalId: string;
    name: string;
    allIds: string[];
}

interface GasShiftAnalyticsOptions {
    fromDate: Date;
    toDate: Date;
    stationId?: string | null;
    shiftNumber?: number | null;
    reconciledOnly?: boolean;
}

const gasStationMetas: GasStationMeta[] = STATIONS
    .filter((station) => station.type === 'GAS')
    .map((station) => ({
        canonicalId: station.id,
        name: station.name,
        allIds: [
            station.id,
            ...(('aliases' in station && station.aliases)
                ? [...station.aliases]
                : []),
        ],
    }));

const gasStationMetaById = new Map<string, GasStationMeta>();
for (const meta of gasStationMetas) {
    for (const stationId of meta.allIds) {
        gasStationMetaById.set(stationId, meta);
    }
}

function toNumber(value: NumericLike): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function roundGasCurrency(value: number): number {
    return Number(value.toFixed(2));
}

function createPaymentBreakdown(): GasPaymentBreakdown {
    return {
        cash: 0,
        credit: 0,
        card: 0,
        transfer: 0,
    };
}

function clonePaymentBreakdown(summary: GasPaymentBreakdown): GasPaymentBreakdown {
    return {
        cash: summary.cash,
        credit: summary.credit,
        card: summary.card,
        transfer: summary.transfer,
    };
}

function getGasStationMeta(stationId: string): GasStationMeta {
    return gasStationMetaById.get(stationId) ?? {
        canonicalId: stationId,
        name: stationId,
        allIds: [stationId],
    };
}

export function getGasAnalyticsStationIds(
    stationIdFilter?: string | null
): string[] {
    if (!stationIdFilter || stationIdFilter === 'all') {
        return [...new Set(gasStationMetas.flatMap((meta) => meta.allIds))];
    }

    const matched = gasStationMetaById.get(stationIdFilter);
    if (matched) {
        return matched.allIds;
    }

    return [stationIdFilter];
}

function getDisplayDate(date: Date): string {
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Bangkok',
    });
}

function getMeterSoldQty(meter: AnalyticsMeterRecord): number {
    const soldQty = toNumber(meter.soldQty);
    if (soldQty > 0) {
        return soldQty;
    }

    const endReading = meter.endReading === null || meter.endReading === undefined
        ? null
        : toNumber(meter.endReading);
    const startReading = toNumber(meter.startReading);
    if (endReading === null) {
        return 0;
    }

    return Math.max(endReading - startReading, 0);
}

function minDate(...dates: Array<Date | null | undefined>): Date | null {
    const validDates = dates.filter((date): date is Date => Boolean(date));
    if (validDates.length === 0) return null;

    return validDates.reduce((min, date) => (
        date.getTime() < min.getTime() ? date : min
    ));
}

function getVarianceDirection(
    variance: number
): 'OVER' | 'SHORT' | 'BALANCED' {
    if (variance > 1) return 'OVER';
    if (variance < -1) return 'SHORT';
    return 'BALANCED';
}

function getVarianceSeverity(variance: number): 'GREEN' | 'YELLOW' | 'RED' {
    if (Math.abs(variance) > 500) return 'RED';
    if (Math.abs(variance) > 100) return 'YELLOW';
    return 'GREEN';
}

export function parseGasVarianceNote(
    varianceNote: string | null | undefined
): {
    cardReceived: number;
    cleanNote: string | null;
} {
    const segments = (varianceNote ?? '')
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);

    let cardReceived = 0;
    const cleanSegments: string[] = [];

    for (const segment of segments) {
        const match = segment.match(/^cardReceived=(-?\d+(?:\.\d+)?)$/i);
        if (match) {
            cardReceived = toNumber(match[1]);
            continue;
        }

        cleanSegments.push(segment);
    }

    return {
        cardReceived: roundGasCurrency(Math.max(cardReceived, 0)),
        cleanNote: cleanSegments.length > 0 ? cleanSegments.join(' | ') : null,
    };
}

export function buildGasVarianceNote(
    varianceNote: string | null | undefined,
    cardReceived: number
): string | null {
    const { cleanNote } = parseGasVarianceNote(varianceNote);
    const normalizedCardReceived = roundGasCurrency(Math.max(cardReceived, 0));
    const parts = [
        cleanNote,
        normalizedCardReceived > 0
            ? `cardReceived=${normalizedCardReceived.toFixed(2)}`
            : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : null;
}

function getReconciliationReceivedPayments(
    reconciliation: AnalyticsReconciliationRecord | null,
    varianceNote: string | null
): GasPaymentBreakdown {
    if (!reconciliation) {
        return createPaymentBreakdown();
    }

    const parsed = parseGasVarianceNote(varianceNote);
    const combinedTransfer = toNumber(reconciliation.transferReceived);
    const cardReceived = Math.min(parsed.cardReceived, combinedTransfer);
    const transferReceived = Math.max(combinedTransfer - cardReceived, 0);

    return {
        cash: toNumber(reconciliation.cashReceived),
        credit: toNumber(reconciliation.creditReceived),
        card: roundGasCurrency(cardReceived),
        transfer: roundGasCurrency(transferReceived),
    };
}

interface ShiftWindow {
    shiftId: string;
    start: Date;
    end: Date;
}

function findMatchingShiftWindow(
    windows: ShiftWindow[] | undefined,
    targetDate: Date
): string | null {
    if (!windows || windows.length === 0) {
        return null;
    }

    const targetTime = targetDate.getTime();
    const matched = windows.find((window) => (
        targetTime >= window.start.getTime()
        && targetTime <= window.end.getTime()
    ));

    return matched?.shiftId ?? null;
}

export function buildGasShiftAnalytics(
    shifts: AnalyticsShiftRecord[],
    transactions: AnalyticsTransactionRecord[]
): GasShiftAnalytics[] {
    const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));
    const shiftWindowsByDailyRecord = new Map<string, ShiftWindow[]>();
    const shiftWindowsByStationDay = new Map<string, ShiftWindow[]>();

    const shiftsByDailyRecord = new Map<string, AnalyticsShiftRecord[]>();
    for (const shift of shifts) {
        const existing = shiftsByDailyRecord.get(shift.dailyRecord.id) ?? [];
        existing.push(shift);
        shiftsByDailyRecord.set(shift.dailyRecord.id, existing);
    }

    for (const [dailyRecordId, dailyShifts] of shiftsByDailyRecord.entries()) {
        const sortedShifts = [...dailyShifts].sort((left, right) => (
            left.createdAt.getTime() - right.createdAt.getTime()
            || left.shiftNumber - right.shiftNumber
        ));

        const windows = sortedShifts.map((shift, index) => {
            const dateKey = toBangkokDateKey(shift.dailyRecord.date);
            const fallbackEnd = getEndOfDayBangkokUTC(dateKey);
            const nextShift = sortedShifts[index + 1];

            return {
                shiftId: shift.id,
                start: shift.createdAt,
                end: minDate(
                    nextShift?.createdAt,
                    shift.closedAt,
                    fallbackEnd
                ) ?? fallbackEnd,
            };
        });

        shiftWindowsByDailyRecord.set(dailyRecordId, windows);

        for (let index = 0; index < sortedShifts.length; index += 1) {
            const shift = sortedShifts[index];
            const stationMeta = getGasStationMeta(shift.dailyRecord.stationId);
            const stationDayKey = `${stationMeta.canonicalId}:${toBangkokDateKey(shift.dailyRecord.date)}`;
            const existing = shiftWindowsByStationDay.get(stationDayKey) ?? [];
            existing.push(windows[index]);
            shiftWindowsByStationDay.set(stationDayKey, existing);
        }
    }

    const transactionsByShiftId = new Map<string, AnalyticsTransactionRecord[]>();
    const orphanTransactionsByStationDay = new Map<string, AnalyticsTransactionRecord[]>();

    for (const transaction of transactions) {
        let matchedShiftId = (
            transaction.shiftId && shiftsById.has(transaction.shiftId)
        ) ? transaction.shiftId : null;

        if (!matchedShiftId && transaction.dailyRecordId) {
            matchedShiftId = findMatchingShiftWindow(
                shiftWindowsByDailyRecord.get(transaction.dailyRecordId),
                transaction.date
            );
        }

        if (!matchedShiftId) {
            const stationMeta = getGasStationMeta(transaction.stationId);
            const stationDayKey = `${stationMeta.canonicalId}:${toBangkokDateKey(transaction.date)}`;
            matchedShiftId = findMatchingShiftWindow(
                shiftWindowsByStationDay.get(stationDayKey),
                transaction.date
            );
        }

        if (!matchedShiftId) {
            const stationMeta = getGasStationMeta(transaction.stationId);
            const stationDayKey = `${stationMeta.canonicalId}:${toBangkokDateKey(transaction.date)}`;
            const existing = orphanTransactionsByStationDay.get(stationDayKey) ?? [];
            existing.push(transaction);
            orphanTransactionsByStationDay.set(stationDayKey, existing);
            continue;
        }

        const existing = transactionsByShiftId.get(matchedShiftId) ?? [];
        existing.push(transaction);
        transactionsByShiftId.set(matchedShiftId, existing);
    }

    const analytics = shifts.map((shift) => {
        const stationMeta = getGasStationMeta(shift.dailyRecord.stationId);
        const assignedTransactions = (transactionsByShiftId.get(shift.id) ?? [])
            .slice()
            .sort((left, right) => left.date.getTime() - right.date.getTime());

        const nozzles = shift.meters
            .slice()
            .sort((left, right) => left.nozzleNumber - right.nozzleNumber)
            .map((meter) => {
                const startReading = toNumber(meter.startReading);
                const endReading = meter.endReading === null || meter.endReading === undefined
                    ? 0
                    : toNumber(meter.endReading);

                return {
                    nozzleNumber: meter.nozzleNumber,
                    startReading,
                    endReading,
                    soldQty: roundGasCurrency(getMeterSoldQty(meter)),
                };
            });

        const meterLiters = roundGasCurrency(
            nozzles.reduce((sum, nozzle) => sum + nozzle.soldQty, 0)
        );

        const expectedPayments = createPaymentBreakdown();
        const transactionAmount = roundGasCurrency(assignedTransactions.reduce((sum, transaction) => {
            const amount = toNumber(transaction.amount);
            addToGasPaymentSummary(expectedPayments, transaction.paymentType, amount);
            return sum + amount;
        }, 0));

        const transactionLiters = roundGasCurrency(
            assignedTransactions.reduce((sum, transaction) => (
                sum + toNumber(transaction.liters)
            ), 0)
        );

        const gasPrice = (() => {
            const value = toNumber(shift.dailyRecord.gasPrice);
            return value > 0 ? value : DEFAULT_GAS_PRICE;
        })();

        const reconciliation = shift.reconciliation;
        const receivedPayments = getReconciliationReceivedPayments(
            reconciliation,
            shift.varianceNote
        );

        const expectedFuelAmount = reconciliation
            ? toNumber(reconciliation.expectedFuelAmount)
            : (transactionAmount > 0
                ? transactionAmount
                : roundGasCurrency(meterLiters * gasPrice));

        const expectedOtherAmount = reconciliation
            ? toNumber(reconciliation.expectedOtherAmount)
            : 0;

        const totalExpected = reconciliation
            ? toNumber(reconciliation.totalExpected)
            : roundGasCurrency(expectedFuelAmount + expectedOtherAmount);

        const totalReceived = reconciliation
            ? toNumber(reconciliation.totalReceived)
            : transactionAmount;

        const variance = reconciliation
            ? toNumber(reconciliation.variance)
            : roundGasCurrency(totalReceived - totalExpected);

        const salesPayments = assignedTransactions.length > 0
            ? clonePaymentBreakdown(expectedPayments)
            : (
                reconciliation
                    ? clonePaymentBreakdown(receivedPayments)
                    : {
                        cash: totalExpected,
                        credit: 0,
                        card: 0,
                        transfer: 0,
                    }
            );

        const salesTotal = transactionAmount > 0 ? transactionAmount : totalExpected;
        const salesLiters = transactionLiters > 0 ? transactionLiters : meterLiters;
        const averageTicket = assignedTransactions.length > 0
            ? roundGasCurrency(transactionAmount / assignedTransactions.length)
            : 0;

        const parsedVarianceNote = parseGasVarianceNote(shift.varianceNote);

        return {
            id: shift.id,
            stationId: stationMeta.canonicalId,
            stationName: stationMeta.name || shift.dailyRecord.station?.name || stationMeta.canonicalId,
            rawStationId: shift.dailyRecord.stationId,
            dateKey: toBangkokDateKey(shift.dailyRecord.date),
            displayDate: getDisplayDate(shift.dailyRecord.date),
            shiftNumber: shift.shiftNumber,
            staffName: shift.staff?.name || null,
            openedAt: shift.createdAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
            status: shift.status,
            gasPrice,
            transactionCount: assignedTransactions.length,
            meters: {
                total: meterLiters,
                transactionLiters,
                litersVariance: roundGasCurrency(transactionLiters - meterLiters),
                nozzles,
            },
            sales: {
                total: roundGasCurrency(salesTotal),
                liters: roundGasCurrency(salesLiters),
                transactions: assignedTransactions.length,
                cash: roundGasCurrency(salesPayments.cash),
                credit: roundGasCurrency(salesPayments.credit),
                card: roundGasCurrency(salesPayments.card),
                transfer: roundGasCurrency(salesPayments.transfer),
                averageTicket,
                expectedPayments: clonePaymentBreakdown(expectedPayments),
            },
            reconciliation: {
                hasRecord: Boolean(reconciliation),
                expected: roundGasCurrency(totalExpected),
                received: roundGasCurrency(totalReceived),
                variance: roundGasCurrency(variance),
                varianceStatus: getVarianceDirection(variance),
                varianceSeverity: reconciliation?.varianceStatus === 'RED'
                    || reconciliation?.varianceStatus === 'YELLOW'
                    || reconciliation?.varianceStatus === 'GREEN'
                    ? reconciliation.varianceStatus
                    : getVarianceSeverity(variance),
                cashExpected: roundGasCurrency(expectedPayments.cash),
                cashReceived: roundGasCurrency(receivedPayments.cash),
                creditExpected: roundGasCurrency(expectedPayments.credit),
                creditReceived: roundGasCurrency(receivedPayments.credit),
                cardExpected: roundGasCurrency(expectedPayments.card),
                cardReceived: roundGasCurrency(receivedPayments.card),
                transferExpected: roundGasCurrency(expectedPayments.transfer),
                transferReceived: roundGasCurrency(receivedPayments.transfer),
                varianceNote: parsedVarianceNote.cleanNote,
            },
        };
    });

    for (const [stationDayKey, orphanTransactions] of orphanTransactionsByStationDay.entries()) {
        const [stationId, dateKey] = stationDayKey.split(':');
        const stationMeta = getGasStationMeta(stationId);
        const sortedTransactions = orphanTransactions
            .slice()
            .sort((left, right) => left.date.getTime() - right.date.getTime());
        const firstTransaction = sortedTransactions[0];
        const expectedPayments = createPaymentBreakdown();
        const transactionAmount = roundGasCurrency(sortedTransactions.reduce((sum, transaction) => {
            const amount = toNumber(transaction.amount);
            addToGasPaymentSummary(expectedPayments, transaction.paymentType, amount);
            return sum + amount;
        }, 0));
        const transactionLiters = roundGasCurrency(sortedTransactions.reduce((sum, transaction) => (
            sum + toNumber(transaction.liters)
        ), 0));
        const averageTicket = sortedTransactions.length > 0
            ? roundGasCurrency(transactionAmount / sortedTransactions.length)
            : 0;
        const gasPrice = transactionLiters > 0
            ? roundGasCurrency(transactionAmount / transactionLiters)
            : DEFAULT_GAS_PRICE;
        const dayDate = getStartOfDayBangkokUTC(dateKey);

        analytics.push({
            id: `orphan:${stationId}:${dateKey}`,
            stationId,
            stationName: stationMeta.name || stationId,
            rawStationId: firstTransaction?.stationId || stationId,
            dateKey,
            displayDate: getDisplayDate(dayDate),
            shiftNumber: 0,
            staffName: null,
            openedAt: firstTransaction?.date.toISOString() || dayDate.toISOString(),
            closedAt: null,
            status: 'UNASSIGNED',
            isSyntheticOrphan: true,
            gasPrice,
            transactionCount: sortedTransactions.length,
            meters: {
                total: 0,
                transactionLiters,
                litersVariance: transactionLiters,
                nozzles: [],
            },
            sales: {
                total: transactionAmount,
                liters: transactionLiters,
                transactions: sortedTransactions.length,
                cash: roundGasCurrency(expectedPayments.cash),
                credit: roundGasCurrency(expectedPayments.credit),
                card: roundGasCurrency(expectedPayments.card),
                transfer: roundGasCurrency(expectedPayments.transfer),
                averageTicket,
                expectedPayments: clonePaymentBreakdown(expectedPayments),
            },
            reconciliation: {
                hasRecord: false,
                expected: transactionAmount,
                received: transactionAmount,
                variance: 0,
                varianceStatus: 'BALANCED',
                varianceSeverity: 'GREEN',
                cashExpected: roundGasCurrency(expectedPayments.cash),
                cashReceived: roundGasCurrency(expectedPayments.cash),
                creditExpected: roundGasCurrency(expectedPayments.credit),
                creditReceived: roundGasCurrency(expectedPayments.credit),
                cardExpected: roundGasCurrency(expectedPayments.card),
                cardReceived: roundGasCurrency(expectedPayments.card),
                transferExpected: roundGasCurrency(expectedPayments.transfer),
                transferReceived: roundGasCurrency(expectedPayments.transfer),
                varianceNote: 'รายการขายที่ยังไม่ผูกกะ',
            },
        });
    }

    return analytics.sort((left, right) => (
        right.dateKey.localeCompare(left.dateKey)
        || left.stationId.localeCompare(right.stationId)
        || left.shiftNumber - right.shiftNumber
        || left.openedAt.localeCompare(right.openedAt)
    ));
}

export function buildGasDailyAnalytics(
    shifts: GasShiftAnalytics[]
): GasDailyAnalytics[] {
    const dayMap = new Map<string, GasDailyAnalytics>();
    const stationDayMap = new Map<string, GasDailyAnalytics['stationBreakdown'][number]>();

    for (const shift of shifts) {
        const existingDay = dayMap.get(shift.dateKey) ?? {
            dateKey: shift.dateKey,
            displayDate: shift.displayDate,
            totalSales: 0,
            totalReceived: 0,
            totalLiters: 0,
            meterLiters: 0,
            transactionLiters: 0,
            litersVariance: 0,
            transactionCount: 0,
            shiftCount: 0,
            cashAmount: 0,
            creditAmount: 0,
            cardAmount: 0,
            transferAmount: 0,
            averageTicket: 0,
            variance: 0,
            stationBreakdown: [],
        };

        existingDay.totalSales += shift.sales.total;
        existingDay.totalReceived += shift.reconciliation?.received ?? shift.sales.total;
        existingDay.totalLiters += shift.sales.liters;
        existingDay.meterLiters += shift.meters.total;
        existingDay.transactionLiters += shift.meters.transactionLiters;
        existingDay.litersVariance += shift.meters.litersVariance;
        existingDay.transactionCount += shift.sales.transactions;
        existingDay.shiftCount += shift.isSyntheticOrphan ? 0 : 1;
        existingDay.cashAmount += shift.sales.cash;
        existingDay.creditAmount += shift.sales.credit;
        existingDay.cardAmount += shift.sales.card;
        existingDay.transferAmount += shift.sales.transfer;
        existingDay.variance += shift.reconciliation?.variance ?? 0;

        dayMap.set(shift.dateKey, existingDay);

        const stationKey = `${shift.dateKey}:${shift.stationId}`;
        const existingStationDay = stationDayMap.get(stationKey) ?? {
            stationId: shift.stationId,
            stationName: shift.stationName,
            totalSales: 0,
            totalReceived: 0,
            totalLiters: 0,
            meterLiters: 0,
            transactionLiters: 0,
            litersVariance: 0,
            transactionCount: 0,
            shiftCount: 0,
            cashAmount: 0,
            creditAmount: 0,
            cardAmount: 0,
            transferAmount: 0,
            variance: 0,
            averageTicket: 0,
        };

        existingStationDay.totalSales += shift.sales.total;
        existingStationDay.totalReceived += shift.reconciliation?.received ?? shift.sales.total;
        existingStationDay.totalLiters += shift.sales.liters;
        existingStationDay.meterLiters += shift.meters.total;
        existingStationDay.transactionLiters += shift.meters.transactionLiters;
        existingStationDay.litersVariance += shift.meters.litersVariance;
        existingStationDay.transactionCount += shift.sales.transactions;
        existingStationDay.shiftCount += shift.isSyntheticOrphan ? 0 : 1;
        existingStationDay.cashAmount += shift.sales.cash;
        existingStationDay.creditAmount += shift.sales.credit;
        existingStationDay.cardAmount += shift.sales.card;
        existingStationDay.transferAmount += shift.sales.transfer;
        existingStationDay.variance += shift.reconciliation?.variance ?? 0;

        stationDayMap.set(stationKey, existingStationDay);
    }

    for (const day of dayMap.values()) {
        day.totalSales = roundGasCurrency(day.totalSales);
        day.totalReceived = roundGasCurrency(day.totalReceived);
        day.totalLiters = roundGasCurrency(day.totalLiters);
        day.meterLiters = roundGasCurrency(day.meterLiters);
        day.transactionLiters = roundGasCurrency(day.transactionLiters);
        day.litersVariance = roundGasCurrency(day.litersVariance);
        day.cashAmount = roundGasCurrency(day.cashAmount);
        day.creditAmount = roundGasCurrency(day.creditAmount);
        day.cardAmount = roundGasCurrency(day.cardAmount);
        day.transferAmount = roundGasCurrency(day.transferAmount);
        day.variance = roundGasCurrency(day.variance);
        day.averageTicket = day.transactionCount > 0
            ? roundGasCurrency(day.totalSales / day.transactionCount)
            : 0;
        day.stationBreakdown = Array.from(stationDayMap.entries())
            .filter(([key]) => key.startsWith(`${day.dateKey}:`))
            .map(([, stationDay]) => ({
                ...stationDay,
                totalSales: roundGasCurrency(stationDay.totalSales),
                totalReceived: roundGasCurrency(stationDay.totalReceived),
                totalLiters: roundGasCurrency(stationDay.totalLiters),
                meterLiters: roundGasCurrency(stationDay.meterLiters),
                transactionLiters: roundGasCurrency(stationDay.transactionLiters),
                litersVariance: roundGasCurrency(stationDay.litersVariance),
                cashAmount: roundGasCurrency(stationDay.cashAmount),
                creditAmount: roundGasCurrency(stationDay.creditAmount),
                cardAmount: roundGasCurrency(stationDay.cardAmount),
                transferAmount: roundGasCurrency(stationDay.transferAmount),
                variance: roundGasCurrency(stationDay.variance),
                averageTicket: stationDay.transactionCount > 0
                    ? roundGasCurrency(stationDay.totalSales / stationDay.transactionCount)
                    : 0,
            }))
            .sort((left, right) => left.stationId.localeCompare(right.stationId));
    }

    return Array.from(dayMap.values()).sort((left, right) => (
        right.dateKey.localeCompare(left.dateKey)
    ));
}

export function buildGasStaffPerformance(
    shifts: GasShiftAnalytics[]
): GasStaffPerformance[] {
    const performanceMap = new Map<string, {
        shiftCount: number;
        totalSales: number;
        totalLiters: number;
        transactionCount: number;
        totalVariance: number;
        stationSet: Set<string>;
    }>();

    for (const shift of shifts) {
        if (!shift.staffName) {
            continue;
        }

        const entry = performanceMap.get(shift.staffName) ?? {
            shiftCount: 0,
            totalSales: 0,
            totalLiters: 0,
            transactionCount: 0,
            totalVariance: 0,
            stationSet: new Set<string>(),
        };

        entry.shiftCount += 1;
        entry.totalSales += shift.sales.total;
        entry.totalLiters += shift.sales.liters;
        entry.transactionCount += shift.sales.transactions;
        entry.totalVariance += shift.reconciliation?.variance ?? 0;
        entry.stationSet.add(shift.stationName);

        performanceMap.set(shift.staffName, entry);
    }

    return Array.from(performanceMap.entries())
        .map(([staffName, entry]) => ({
            staffName,
            shiftCount: entry.shiftCount,
            stationCount: entry.stationSet.size,
            totalSales: roundGasCurrency(entry.totalSales),
            totalLiters: roundGasCurrency(entry.totalLiters),
            transactionCount: entry.transactionCount,
            averageTicket: entry.transactionCount > 0
                ? roundGasCurrency(entry.totalSales / entry.transactionCount)
                : 0,
            averageLitersPerShift: entry.shiftCount > 0
                ? roundGasCurrency(entry.totalLiters / entry.shiftCount)
                : 0,
            averageVariance: entry.shiftCount > 0
                ? roundGasCurrency(entry.totalVariance / entry.shiftCount)
                : 0,
            stations: Array.from(entry.stationSet.values()).sort(),
        }))
        .sort((left, right) => (
            right.totalSales - left.totalSales
            || right.totalLiters - left.totalLiters
        ));
}

export function buildGasNozzlePerformance(
    shifts: GasShiftAnalytics[]
): GasNozzlePerformance[] {
    const performanceMap = new Map<string, {
        stationId: string;
        stationName: string;
        nozzleNumber: number;
        shiftCount: number;
        totalLiters: number;
        estimatedSales: number;
    }>();

    for (const shift of shifts) {
        for (const nozzle of shift.meters.nozzles) {
            const key = `${shift.stationId}:${nozzle.nozzleNumber}`;
            const entry = performanceMap.get(key) ?? {
                stationId: shift.stationId,
                stationName: shift.stationName,
                nozzleNumber: nozzle.nozzleNumber,
                shiftCount: 0,
                totalLiters: 0,
                estimatedSales: 0,
            };

            entry.shiftCount += 1;
            entry.totalLiters += nozzle.soldQty;
            entry.estimatedSales += nozzle.soldQty * shift.gasPrice;

            performanceMap.set(key, entry);
        }
    }

    return Array.from(performanceMap.values())
        .map((entry) => ({
            stationId: entry.stationId,
            stationName: entry.stationName,
            nozzleNumber: entry.nozzleNumber,
            shiftCount: entry.shiftCount,
            totalLiters: roundGasCurrency(entry.totalLiters),
            averageLitersPerShift: entry.shiftCount > 0
                ? roundGasCurrency(entry.totalLiters / entry.shiftCount)
                : 0,
            estimatedSales: roundGasCurrency(entry.estimatedSales),
        }))
        .sort((left, right) => (
            right.totalLiters - left.totalLiters
            || left.stationId.localeCompare(right.stationId)
            || left.nozzleNumber - right.nozzleNumber
        ));
}

export async function getGasShiftAnalyticsData(
    options: GasShiftAnalyticsOptions
): Promise<GasShiftAnalytics[]> {
    const stationIds = getGasAnalyticsStationIds(options.stationId);

    const [shifts, transactions] = await Promise.all([
        prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId: { in: stationIds },
                    date: {
                        gte: options.fromDate,
                        lte: options.toDate,
                    },
                },
                ...(options.shiftNumber ? { shiftNumber: options.shiftNumber } : {}),
                ...(options.reconciledOnly ? { reconciliation: { isNot: null } } : {}),
            },
            include: {
                dailyRecord: {
                    include: {
                        station: {
                            select: { name: true },
                        },
                    },
                },
                staff: {
                    select: { name: true },
                },
                meters: {
                    orderBy: { nozzleNumber: 'asc' },
                },
                reconciliation: true,
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'asc' },
                { createdAt: 'asc' },
            ],
        }),
        prisma.transaction.findMany({
            where: {
                stationId: { in: stationIds },
                date: {
                    gte: options.fromDate,
                    lte: options.toDate,
                },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                id: true,
                stationId: true,
                dailyRecordId: true,
                shiftId: true,
                date: true,
                paymentType: true,
                liters: true,
                amount: true,
            },
            orderBy: { date: 'asc' },
        }),
    ]);

    return buildGasShiftAnalytics(shifts, transactions);
}
