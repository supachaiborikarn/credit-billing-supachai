/**
 * Billing Service - รวม logic สำหรับ Billing
 * 
 * จัดการเรื่องใบวางบิล, Invoice, และการชำระเงิน
 */

import { prisma } from '@/lib/prisma';
import { InvoiceStatus, InvoiceStatusLabels } from '@/constants';

export interface InvoiceSummary {
    id: string;
    invoiceNumber: string;
    ownerName: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    statusLabel: string;
    dueDate: Date | null;
    transactionCount: number;
}

export interface BillingPeriod {
    startDate: Date;
    endDate: Date;
    label: string;
}

/**
 * สร้าง billing periods (งวดบิล)
 * @param date วันที่อ้างอิง
 * @returns รายการงวดบิล
 */
export function getBillingPeriods(date: Date = new Date()): BillingPeriod[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    // งวดครึ่งเดือนแรก (1-15)
    const firstHalf: BillingPeriod = {
        startDate: new Date(year, month, 1),
        endDate: new Date(year, month, 15, 23, 59, 59),
        label: `1-15 ${date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
    };

    // งวดครึ่งเดือนหลัง (16-สิ้นเดือน)
    const lastDay = new Date(year, month + 1, 0).getDate();
    const secondHalf: BillingPeriod = {
        startDate: new Date(year, month, 16),
        endDate: new Date(year, month, lastDay, 23, 59, 59),
        label: `16-${lastDay} ${date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
    };

    return [firstHalf, secondHalf];
}

/**
 * คำนวณ aging ของ invoice (อายุหนี้)
 */
export function calculateAgingDays(dueDate: Date | null, fromDate: Date = new Date()): number {
    if (!dueDate) return 0;
    const diffTime = fromDate.getTime() - dueDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * จัดกลุ่ม aging
 */
export function getAgingGroup(agingDays: number): {
    group: 'current' | '1-30' | '31-60' | '61-90' | 'over90';
    label: string;
    color: string;
} {
    if (agingDays <= 0) {
        return { group: 'current', label: 'ยังไม่ครบกำหนด', color: 'text-green-600' };
    } else if (agingDays <= 30) {
        return { group: '1-30', label: 'ค้าง 1-30 วัน', color: 'text-yellow-600' };
    } else if (agingDays <= 60) {
        return { group: '31-60', label: 'ค้าง 31-60 วัน', color: 'text-orange-600' };
    } else if (agingDays <= 90) {
        return { group: '61-90', label: 'ค้าง 61-90 วัน', color: 'text-red-500' };
    } else {
        return { group: 'over90', label: 'ค้างเกิน 90 วัน', color: 'text-red-700' };
    }
}

/**
 * สร้างหมายเลข Invoice
 */
export function generateInvoiceNumber(prefix: string = 'INV'): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${prefix}-${year}${month}${day}-${random}`;
}

/**
 * คำนวณยอดรวมที่ต้องชำระ
 */
export function calculateTotalDue(
    transactions: Array<{ amount: unknown }>
): number {
    return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
}

/**
 * ดู status label ภาษาไทย
 */
export function getInvoiceStatusLabel(status: string): string {
    return InvoiceStatusLabels[status as keyof typeof InvoiceStatusLabels] || status;
}
