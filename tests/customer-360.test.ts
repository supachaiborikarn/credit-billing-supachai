import { describe, expect, it } from 'vitest';
import type { NormalizedBillingDocument } from '@/lib/billing/adapter';
import {
    buildCustomerCreditContext,
    buildCustomerPaymentHistory,
    toCustomerBillingDocument,
} from '@/lib/customers/customer-360';

function document(overrides: Partial<NormalizedBillingDocument> = {}): NormalizedBillingDocument {
    return {
        id: 'doc-1',
        kind: 'INVOICE',
        number: 'INV-001',
        owner: { id: 'owner-1', name: 'Customer', code: null },
        totalAmount: 1000,
        paidAmount: 200,
        remainingAmount: 800,
        rawStatus: 'PARTIAL',
        stage: 'PARTIAL',
        dueDate: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        overdue: false,
        sourceItemCount: 2,
        paymentEvents: [],
        attention: { overdue: false, pendingPaymentReviews: 0, rejectedPaymentEvidence: 0 },
        dataQualityFlags: [],
        ...overrides,
    };
}

describe('customer 360 contract', () => {
    it('keeps unbilled, invoice, collection and legacy credit in separate buckets', () => {
        const credit = buildCustomerCreditContext({
            creditLimit: 10000,
            legacyCurrentCredit: 500,
            unbilledTransactionCount: 3,
            unbilledAmount: 1500,
            documents: [
                document(),
                document({
                    id: 'collection-1',
                    kind: 'BILLING_COLLECTION',
                    number: 'BC-001',
                    remainingAmount: 300,
                    totalAmount: 300,
                    paidAmount: 0,
                    stage: 'AWAITING_PAYMENT',
                }),
            ],
        });

        expect(credit.legacyCurrentCredit).toBe(500);
        expect(credit.unbilledCredit.amount).toBe(1500);
        expect(credit.invoiceOutstanding.amount).toBe(800);
        expect(credit.collectionOutstanding.amount).toBe(300);
        expect(credit.combinedOutstandingSuppressed).toBe(true);
        expect(credit.legacyCreditIsAuthoritative).toBe(false);
    });

    it('counts overdue and pending payment reviews from normalized documents', () => {
        const credit = buildCustomerCreditContext({
            creditLimit: 1000,
            legacyCurrentCredit: 0,
            unbilledTransactionCount: 0,
            unbilledAmount: 0,
            documents: [
                document({ overdue: true, attention: { overdue: true, pendingPaymentReviews: 0, rejectedPaymentEvidence: 0 } }),
                document({
                    id: 'collection-2',
                    kind: 'BILLING_COLLECTION',
                    attention: { overdue: false, pendingPaymentReviews: 2, rejectedPaymentEvidence: 0 },
                }),
            ],
        });

        expect(credit.overdueDocuments).toBe(1);
        expect(credit.pendingPaymentReviews).toBe(2);
    });

    it('builds a traceable payment timeline sorted newest first', () => {
        const history = buildCustomerPaymentHistory([
            document({
                paymentEvents: [{
                    id: 'pay-old',
                    source: 'PAYMENT',
                    amount: 100,
                    status: 'CONFIRMED',
                    occurredAt: '2026-08-01T00:00:00.000Z',
                    method: 'TRANSFER',
                    evidenceUrl: null,
                    notes: null,
                }],
            }),
            document({
                id: 'collection-2',
                kind: 'BILLING_COLLECTION',
                number: 'BC-002',
                paymentEvents: [{
                    id: 'pay-new',
                    source: 'PAYMENT_SLIP',
                    amount: 200,
                    status: 'PENDING_REVIEW',
                    occurredAt: '2026-08-02T00:00:00.000Z',
                    method: 'BANK',
                    evidenceUrl: '/slip.jpg',
                    notes: null,
                }],
            }),
        ]);

        expect(history.map((item) => item.id)).toEqual(['pay-new', 'pay-old']);
        expect(history[0]).toMatchObject({ documentKind: 'BILLING_COLLECTION', documentNumber: 'BC-002' });
    });

    it('maps billing documents without losing data-quality flags', () => {
        const mapped = toCustomerBillingDocument(document({ dataQualityFlags: ['MISSING_SOURCE_ITEMS'] }));
        expect(mapped.dataQualityFlags).toEqual(['MISSING_SOURCE_ITEMS']);
        expect(mapped.remainingAmount).toBe(800);
    });
});
