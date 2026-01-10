/**
 * Gas Station Date Utilities
 * 
 * All dates are stored as Bangkok midnight (UTC+7)
 * This ensures consistent date handling across the system
 */

// Bangkok timezone offset: UTC+7
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Get current date in Bangkok timezone as YYYY-MM-DD string
 */
export function getTodayBangkok(): string {
    const now = new Date();
    const bangkokTime = new Date(now.getTime() + BANGKOK_OFFSET_MS);
    return bangkokTime.toISOString().split('T')[0];
}

/**
 * Convert any date to Bangkok date string (YYYY-MM-DD)
 * This is the standard dateKey format used in DailyRecord
 */
export function toBangkokDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const bangkokTime = new Date(d.getTime() + BANGKOK_OFFSET_MS);
    return bangkokTime.toISOString().split('T')[0];
}

/**
 * Convert Bangkok date string to UTC midnight for database storage
 * Input: "2026-01-10" (Bangkok date)
 * Output: Date object at 2026-01-09T17:00:00.000Z (UTC)
 */
export function bangkokDateToUTC(dateKey: string): Date {
    // Parse as Bangkok midnight, then convert to UTC
    const [year, month, day] = dateKey.split('-').map(Number);
    // Create date at Bangkok midnight (00:00 Bangkok = 17:00 UTC previous day)
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return new Date(utcDate.getTime() - BANGKOK_OFFSET_MS);
}

/**
 * Get start of day in Bangkok timezone as UTC Date
 * Used for date range queries (gte)
 */
export function getStartOfDayBangkokUTC(dateKey: string): Date {
    return bangkokDateToUTC(dateKey);
}

/**
 * Get end of day in Bangkok timezone as UTC Date
 * Used for date range queries (lte)
 */
export function getEndOfDayBangkokUTC(dateKey: string): Date {
    const start = bangkokDateToUTC(dateKey);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Check if two dates are the same Bangkok day
 */
export function isSameBangkokDay(date1: Date, date2: Date): boolean {
    return toBangkokDateKey(date1) === toBangkokDateKey(date2);
}

/**
 * Format date for display in Thai locale
 */
export function formatThaiDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Bangkok'
    });
}

/**
 * Format time for display in Thai locale (HH:mm)
 */
export function formatThaiTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
    });
}

/**
 * Format datetime for display in Thai locale
 */
export function formatThaiDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
    });
}

/**
 * Get date range for querying database
 * Returns { start, end } for use in Prisma where clause
 */
export function getDateRangeUTC(fromDateKey: string, toDateKey: string) {
    return {
        start: getStartOfDayBangkokUTC(fromDateKey),
        end: getEndOfDayBangkokUTC(toDateKey)
    };
}

/**
 * Validate dateKey format (YYYY-MM-DD)
 */
export function isValidDateKey(dateKey: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return false;
    }
    const date = new Date(dateKey);
    return !isNaN(date.getTime());
}
