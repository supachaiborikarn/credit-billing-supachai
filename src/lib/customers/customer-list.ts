import type { CustomerAttentionLevel } from '@/types/customer';

export interface CustomerAttentionInput {
    status: string;
    creditLimit: number;
    legacyCurrentCredit: number;
    overdueDocuments: number;
    pendingPaymentReviews: number;
    unbilledAmount: number;
    invoiceOutstandingAmount: number;
    collectionOutstandingAmount: number;
}

export function deriveCustomerAttention(input: CustomerAttentionInput): {
    level: CustomerAttentionLevel;
    overdueDocuments: number;
    pendingPaymentReviews: number;
    legacyOverLimit: boolean;
    inactive: boolean;
    labels: string[];
} {
    const legacyOverLimit = input.creditLimit > 0 && input.legacyCurrentCredit > input.creditLimit + 0.01;
    const inactive = input.status !== 'ACTIVE';
    const labels: string[] = [];

    if (input.overdueDocuments > 0) labels.push(`เกินกำหนด ${input.overdueDocuments} เอกสาร`);
    if (input.pendingPaymentReviews > 0) labels.push(`รอตรวจสลิป ${input.pendingPaymentReviews}`);
    if (legacyOverLimit) labels.push('legacy credit เกินวงเงิน');
    if (inactive) labels.push(input.status === 'SUSPENDED' ? 'ระงับใช้งาน' : 'ไม่ได้ใช้งาน');
    if (
        labels.length === 0
        && (input.unbilledAmount > 0 || input.invoiceOutstandingAmount > 0 || input.collectionOutstandingAmount > 0)
    ) {
        labels.push('มียอดค้างติดตาม');
    }

    let level: CustomerAttentionLevel = 'NONE';
    if (inactive || legacyOverLimit || input.overdueDocuments > 0) level = 'CRITICAL';
    else if (input.pendingPaymentReviews > 0) level = 'WARNING';
    else if (labels.length > 0) level = 'INFO';

    return {
        level,
        overdueDocuments: input.overdueDocuments,
        pendingPaymentReviews: input.pendingPaymentReviews,
        legacyOverLimit,
        inactive,
        labels,
    };
}

export function getCustomerNextAction(args: {
    id: string;
    overdueDocuments: number;
    pendingPaymentReviews: number;
    unbilledAmount: number;
}): { label: string; href: string } {
    if (args.overdueDocuments > 0) {
        return { label: 'ดูหนี้เกินกำหนด', href: `/customers/${args.id}` };
    }
    if (args.pendingPaymentReviews > 0) {
        return { label: 'ตรวจการชำระ', href: `/customers/${args.id}` };
    }
    if (args.unbilledAmount > 0) {
        return { label: 'ดูรายการรอวางบิล', href: `/customers/${args.id}` };
    }
    return { label: 'ดูข้อมูลลูกค้า', href: `/customers/${args.id}` };
}
