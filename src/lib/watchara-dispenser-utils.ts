import { formatDateBangkok, getStartOfDayBangkok } from '@/lib/date-utils';

export const WATCHARA_DISPENSER_SOURCE_CODE = 'watchara_shared_dispenser';
export const WATCHARA_DISPENSER_SOURCE_NAME = 'Watchara shared dispenser';
export const WATCHARA_EXTERNAL_STATION_REF = 'station-1';
export const WATCHARA_LOCAL_STATION_ID = 'station-2';
export const WATCHARA_FUEL_FAMILY = 'DIESEL';
export const WATCHARA_ROLLUP_MODE = 'all_day_single_shift';
export const WATCHARA_DEFAULT_SHIFT_KEY = 'ALL_DAY';
export const WATCHARA_STALE_AFTER_HOURS = 48;

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyUtc(dateStr: string): Date {
    if (!ISO_DATE_ONLY_RE.test(dateStr)) {
        throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD`);
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function getWatcharaDispenserDatabaseUrl(): string | null {
    const value = process.env.WATCHARA_DISPENSER_DATABASE_URL?.trim();
    return value ? value : null;
}

export function normalizeWatcharaBusinessDate(anchor: Date): string {
    return formatDateBangkok(anchor);
}

export function toWatcharaBusinessDate(anchor: Date): Date {
    return getStartOfDayBangkok(normalizeWatcharaBusinessDate(anchor));
}

export function validateWatcharaSyncDateRange(
    startDate: string,
    endDate: string,
    maxDays: number = 31
): { startDate: string; endDate: string; dayCount: number } {
    const start = parseDateOnlyUtc(startDate);
    const end = parseDateOnlyUtc(endDate);

    if (end.getTime() < start.getTime()) {
        throw new Error('endDate must be the same day or later than startDate');
    }

    const dayCount = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (dayCount > maxDays) {
        throw new Error(`Date range is too large (${dayCount} days). Maximum allowed is ${maxDays} days`);
    }

    return { startDate, endDate, dayCount };
}

export function getWatcharaDispenserStaleInfo(
    lastSeenSourceAt: Date | null,
    now: Date = new Date()
): { isStale: boolean; staleHours: number | null; thresholdHours: number } {
    if (!lastSeenSourceAt) {
        return {
            isStale: false,
            staleHours: null,
            thresholdHours: WATCHARA_STALE_AFTER_HOURS,
        };
    }

    const staleHours = (now.getTime() - lastSeenSourceAt.getTime()) / (60 * 60 * 1000);

    return {
        isStale: staleHours >= WATCHARA_STALE_AFTER_HOURS,
        staleHours: Math.round(staleHours * 100) / 100,
        thresholdHours: WATCHARA_STALE_AFTER_HOURS,
    };
}
