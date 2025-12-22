// Formatting Utilities
// Provides consistent number and currency formatting across the app

/**
 * Format number with Thai locale (thousands separator)
 */
export function formatNumber(
    num: number,
    options: { decimals?: number; prefix?: string; suffix?: string } = {}
): string {
    const { decimals = 2, prefix = '', suffix = '' } = options;
    const formatted = new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    }).format(num);
    return `${prefix}${formatted}${suffix}`;
}

/**
 * Format currency in Thai Baht
 */
export function formatCurrency(num: number): string {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

/**
 * Format liters with unit
 */
export function formatLiters(num: number): string {
    return `${formatNumber(num)} ล.`;
}

/**
 * Format Thai date
 */
export function formatThaiDate(
    date: Date | string,
    options: Intl.DateTimeFormatOptions = {}
): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
    });
}

/**
 * Format Thai date with time
 */
export function formatThaiDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

    return formatThaiDate(d);
}
