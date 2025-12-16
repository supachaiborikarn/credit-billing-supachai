/**
 * Shared formatting utilities for the Credit Billing application
 */

/**
 * Format number with Thai locale (comma separators)
 */
export const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('th-TH').format(num);
};

/**
 * Format currency with 2 decimal places
 */
export const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

/**
 * Format number in compact form (K, M)
 */
export const formatCompact = (num: number): string => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
};

/**
 * Format date to Thai locale string
 */
export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH');
};

/**
 * Format time to Thai locale string (HH:mm)
 */
export const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
};
