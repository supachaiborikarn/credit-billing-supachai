import { describe, expect, it } from 'vitest';
import { deriveCustomerAttention, getCustomerNextAction } from '@/lib/customers/customer-list';

describe('customer list attention', () => {
    it('prioritizes overdue as critical', () => {
        const attention = deriveCustomerAttention({
            status: 'ACTIVE',
            creditLimit: 10000,
            legacyCurrentCredit: 100,
            overdueDocuments: 2,
            pendingPaymentReviews: 1,
            unbilledAmount: 500,
            invoiceOutstandingAmount: 1000,
            collectionOutstandingAmount: 0,
        });
        expect(attention.level).toBe('CRITICAL');
        expect(attention.labels[0]).toContain('เกินกำหนด');
    });

    it('treats pending slip review as warning', () => {
        const attention = deriveCustomerAttention({
            status: 'ACTIVE',
            creditLimit: 10000,
            legacyCurrentCredit: 0,
            overdueDocuments: 0,
            pendingPaymentReviews: 1,
            unbilledAmount: 0,
            invoiceOutstandingAmount: 0,
            collectionOutstandingAmount: 500,
        });
        expect(attention.level).toBe('WARNING');
    });

    it('does not combine outstanding buckets and uses info for ordinary outstanding', () => {
        const attention = deriveCustomerAttention({
            status: 'ACTIVE',
            creditLimit: 10000,
            legacyCurrentCredit: 0,
            overdueDocuments: 0,
            pendingPaymentReviews: 0,
            unbilledAmount: 100,
            invoiceOutstandingAmount: 200,
            collectionOutstandingAmount: 300,
        });
        expect(attention.level).toBe('INFO');
        expect(attention.labels).toEqual(['มียอดค้างติดตาม']);
    });

    it('chooses the next action from the highest-priority work', () => {
        expect(getCustomerNextAction({ id: 'a', overdueDocuments: 1, pendingPaymentReviews: 2, unbilledAmount: 100 }).label)
            .toBe('ดูหนี้เกินกำหนด');
        expect(getCustomerNextAction({ id: 'a', overdueDocuments: 0, pendingPaymentReviews: 2, unbilledAmount: 100 }).label)
            .toBe('ตรวจการชำระ');
        expect(getCustomerNextAction({ id: 'a', overdueDocuments: 0, pendingPaymentReviews: 0, unbilledAmount: 100 }).label)
            .toBe('ดูรายการรอวางบิล');
    });
});
