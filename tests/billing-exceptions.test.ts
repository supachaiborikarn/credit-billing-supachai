import { describe, expect, it } from 'vitest';
import { getBillingExceptions } from '../src/lib/billing/exceptions';
import type { NormalizedBillingDocument } from '../src/lib/billing/adapter';

function baseDocument(overrides: Partial<NormalizedBillingDocument> = {}): NormalizedBillingDocument {
    return {
        id: 'doc-1',
        kind: 'INVOICE',
        number: 'INV-1',
        owner: { id: 'owner-1', name: 'ลูกค้า', code: null },
        totalAmount: 1000,
        paidAmount: 0,
        remainingAmount: 1000,
        rawStatus: 'PENDING',
        stage: 'AWAITING_PAYMENT',
        dueDate: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        overdue: false,
        sourceItemCount: 1,
        paymentEvents: [],
        attention: {
            overdue: false,
            pendingPaymentReviews: 0,
            rejectedPaymentEvidence: 0,
        },
        dataQualityFlags: [],
        ...overrides,
    };
}

describe('billing exceptions', () => {
    it('maps missing source into a critical exception', () => {
        const exceptions = getBillingExceptions(baseDocument({
            sourceItemCount: 0,
            dataQualityFlags: ['MISSING_SOURCE_ITEMS'],
        }));
        expect(exceptions).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'MISSING_SOURCE', severity: 'critical' }),
        ]));
    });

    it('maps payment/status mismatches into financial exceptions', () => {
        const exceptions = getBillingExceptions(baseDocument({
            dataQualityFlags: ['PAID_AMOUNT_MISMATCH', 'STATUS_AMOUNT_MISMATCH'],
        }));
        expect(exceptions.map((item) => item.type)).toEqual(expect.arrayContaining([
            'PAYMENT_MISMATCH',
            'INVALID_FINANCIAL_STATE',
        ]));
    });

    it('maps overdue into an attention exception', () => {
        const exceptions = getBillingExceptions(baseDocument({
            overdue: true,
            attention: { overdue: true, pendingPaymentReviews: 0, rejectedPaymentEvidence: 0 },
        }));
        expect(exceptions).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'OVERDUE', severity: 'warning' }),
        ]));
    });

    it('treats multiple pending slips as duplicate-invalid evidence state', () => {
        const exceptions = getBillingExceptions(baseDocument({
            kind: 'BILLING_COLLECTION',
            attention: { overdue: false, pendingPaymentReviews: 2, rejectedPaymentEvidence: 0 },
        }));
        expect(exceptions.map((item) => item.type)).toEqual(expect.arrayContaining([
            'PENDING_PAYMENT_REVIEW',
            'DUPLICATE_PENDING_EVIDENCE',
        ]));
    });
});
