import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from './date-utils';

export interface GasActiveShiftDateRange {
    currentDateKey: string;
    previousDateKey: string;
    start: Date;
    end: Date;
}

export function addDaysToBangkokDateKey(dateKey: string, days: number): string {
    const date = getStartOfDayBangkokUTC(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    return toBangkokDateKey(date);
}

/**
 * GAS has two 24-hour-covering shifts, so an OPEN night shift can belong to
 * yesterday's business date and still be the current shift after midnight.
 */
export function getGasActiveShiftDateRange(referenceDateKey = getGasBusinessDateKey()): GasActiveShiftDateRange {
    const previousDateKey = addDaysToBangkokDateKey(referenceDateKey, -1);

    return {
        currentDateKey: referenceDateKey,
        previousDateKey,
        start: getStartOfDayBangkokUTC(previousDateKey),
        end: getEndOfDayBangkokUTC(referenceDateKey),
    };
}
