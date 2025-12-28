/**
 * Invoice Status - สถานะใบแจ้งหนี้
 * Synced with Prisma enum InvoiceStatus
 */

export const InvoiceStatus = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    PARTIAL: 'PARTIAL',
} as const;

export type InvoiceStatusValue = typeof InvoiceStatus[keyof typeof InvoiceStatus];

/**
 * Thai labels for invoice status
 */
export const InvoiceStatusLabels: Record<InvoiceStatusValue, string> = {
    PENDING: 'รอชำระ',
    PAID: 'ชำระแล้ว',
    PARTIAL: 'ชำระบางส่วน',
};

/**
 * Daily Record Status - สถานะบันทึกประจำวัน
 * Synced with Prisma enum DailyRecordStatus
 */
export const DailyRecordStatus = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
} as const;

export type DailyRecordStatusValue = typeof DailyRecordStatus[keyof typeof DailyRecordStatus];

/**
 * Thai labels for daily record status
 */
export const DailyRecordStatusLabels: Record<DailyRecordStatusValue, string> = {
    OPEN: 'เปิด',
    CLOSED: 'ปิด',
};
