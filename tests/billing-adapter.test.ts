import { describe, expect, it } from 'vitest';
import {
    normalizeCollectionBillingDocument,
    normalizeInvoiceBillingDocument,
} from '../src/lib/billing/adapter';

const NOW = new Date('2026-08-27T00:00:00.000Z');

describe('billing adapter', () => {
    it('normalizes Invoice + Payment as an immediately confirmed payment stream', () => {
        const result = normalizeInvoiceBillingDocument({
            id: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '1000',
            paidAmount: '250',
            status: 'PARTIAL',
            dueDate: '2026-08-20T00:00:00.000Z',
            createdAt: '2026-08-01T00:00:00.000Z',
            owner: { id: 'owner-1', name: 'ลูกค้า A', code: 'A01' },
            _count: { transactions: 3 },
            payments: [{
                id: 'pay-1',
                amount: 250,
                paymentDate: '2026-08-10T00:00:00.000Z',
                paymentMethod: 'TRANSFER',
            }],
        }, NOW);

        expect(result.kind).toBe('INVOICE');
        expect(result.stage).toBe('PARTIAL');
        expect(result.remainingAmount).toBe(750);
        expect(result.overdue).toBe(true);
        expect(result.sourceItemCount).toBe(3);
        expect(result.paymentEvents[0]).toMatchObject({
            source: 'PAYMENT',
            status: 'CONFIRMED',
            amount: 250,
        });
        expect(result.dataQualityFlags).toEqual([]);
    });

    it('derives Invoice stage from amounts even when a raw status is stale', () => {
        const result = normalizeInvoiceBillingDocument({
            id: 'inv-2',
            invoiceNumber: 'INV-002',
            totalAmount: 1000,
            paidAmount: 1000,
            status: 'PENDING',
            createdAt: '2026-08-01T00:00:00.000Z',
            owner: { id: 'owner-2', name: 'ลูกค้า B' },
        }, NOW);

        expect(result.stage).toBe('CLOSED');
        expect(result.dataQualityFlags).toContain('STATUS_AMOUNT_MISMATCH');
    });

    it('normalizes BillingCollection slips without counting pending or rejected evidence as paid', () => {
        const result = normalizeCollectionBillingDocument({
            id: 'bc-1',
            collectionNo: 'BC-001',
            ownerId: 'owner-1',
            ownerName: 'ลูกค้า A',
            totalAmount: 1000,
            paidAmount: 400,
            status: 'PARTIAL',
            dueDate: '2026-08-20T00:00:00.000Z',
            createdAt: '2026-08-01T00:00:00.000Z',
            _count: { items: 4, paymentSlips: 3 },
            paymentSlips: [
                {
                    id: 'slip-ok',
                    amount: 400,
                    createdAt: '2026-08-10T00:00:00.000Z',
                    slipImageUrl: 'https://example.com/ok.webp',
                    status: 'VERIFIED',
                },
                {
                    id: 'slip-pending',
                    amount: 300,
                    createdAt: '2026-08-11T00:00:00.000Z',
                    slipImageUrl: 'https://example.com/pending.webp',
                    status: 'PENDING',
                },
                {
                    id: 'slip-rejected',
                    amount: 200,
                    createdAt: '2026-08-12T00:00:00.000Z',
                    slipImageUrl: 'https://example.com/rejected.webp',
                    status: 'REJECTED',
                },
            ],
        }, NOW);

        expect(result.kind).toBe('BILLING_COLLECTION');
        expect(result.stage).toBe('PARTIAL');
        expect(result.paidAmount).toBe(400);
        expect(result.attention).toEqual({
            overdue: true,
            pendingPaymentReviews: 1,
            rejectedPaymentEvidence: 1,
        });
        expect(result.paymentEvents.map((event) => event.status)).toEqual([
            'CONFIRMED',
            'PENDING_REVIEW',
            'REJECTED',
        ]);
        expect(result.dataQualityFlags).toEqual([]);
    });

    it('flags a collection when paidAmount disagrees with verified slips', () => {
        const result = normalizeCollectionBillingDocument({
            id: 'bc-2',
            collectionNo: 'BC-002',
            ownerId: 'owner-2',
            ownerName: 'ลูกค้า B',
            totalAmount: 1000,
            paidAmount: 500,
            status: 'PARTIAL',
            createdAt: '2026-08-01T00:00:00.000Z',
            paymentSlips: [{
                id: 'slip-1',
                amount: 400,
                createdAt: '2026-08-10T00:00:00.000Z',
                slipImageUrl: 'https://example.com/slip.webp',
                status: 'VERIFIED',
            }],
        }, NOW);

        expect(result.dataQualityFlags).toContain('PAID_AMOUNT_MISMATCH');
    });
});
