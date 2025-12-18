/**
 * Date utilities for consistent timezone handling
 * All dates should be treated as Asia/Bangkok (UTC+7)
 */

const BANGKOK_OFFSET_HOURS = 7;

/**
 * Parse a date string (YYYY-MM-DD) as Bangkok timezone midnight
 * Returns a Date object representing 00:00:00 in Bangkok time
 */
export function parseBangkokDate(dateStr: string): Date {
    // Create date as UTC midnight, then subtract 7 hours to get Bangkok midnight in UTC
    // E.g., "2025-12-18" at 00:00 Bangkok = "2025-12-17T17:00:00Z" in UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Subtract Bangkok offset to get the correct UTC time for Bangkok midnight
    utcDate.setUTCHours(utcDate.getUTCHours() - BANGKOK_OFFSET_HOURS);
    return utcDate;
}

/**
 * Get start of day in Bangkok timezone as UTC Date
 * E.g., for "2025-12-18", returns 2025-12-17T17:00:00.000Z
 */
export function getStartOfDayBangkok(dateStr: string): Date {
    return parseBangkokDate(dateStr);
}

/**
 * Get end of day in Bangkok timezone as UTC Date
 * E.g., for "2025-12-18", returns 2025-12-18T16:59:59.999Z
 */
export function getEndOfDayBangkok(dateStr: string): Date {
    const start = parseBangkokDate(dateStr);
    start.setUTCHours(start.getUTCHours() + 23);
    start.setUTCMinutes(59);
    start.setUTCSeconds(59);
    start.setUTCMilliseconds(999);
    return start;
}

/**
 * Create a transaction date with the selected Bangkok date and current Bangkok time
 */
export function createTransactionDate(dateStr: string): Date {
    // Get current time in Bangkok
    const now = new Date();
    const bangkokTime = new Date(now.getTime() + BANGKOK_OFFSET_HOURS * 60 * 60 * 1000);

    const hours = bangkokTime.getUTCHours();
    const minutes = bangkokTime.getUTCMinutes();
    const seconds = bangkokTime.getUTCSeconds();

    // Parse the date string and add current Bangkok time
    const [year, month, day] = dateStr.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));
    // Subtract Bangkok offset to convert back to UTC
    result.setUTCHours(result.getUTCHours() - BANGKOK_OFFSET_HOURS);
    return result;
}

/**
 * Format a Date to YYYY-MM-DD in Bangkok timezone
 */
export function formatDateBangkok(date: Date): string {
    const bangkokTime = new Date(date.getTime() + BANGKOK_OFFSET_HOURS * 60 * 60 * 1000);
    return bangkokTime.toISOString().split('T')[0];
}

/**
 * Get today's date string in Bangkok timezone
 */
export function getTodayBangkok(): string {
    return formatDateBangkok(new Date());
}
