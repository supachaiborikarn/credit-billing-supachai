import { describe, expect, it } from 'vitest';
import { buildBillingOutstandingSummary } from '../src/lib/billing/outstanding-summary';

describe('billing outstanding bucket summary', () => {
    it('keeps unbilled, invoice and collection amounts in separate buckets', () => {
        const result = buildBillingOutstandingSummary({
            pendingOwners: [
                { transactions: [{ amount: 100 }, { amount: '50.5' }] },
                { transactions: [{ amount: 20 }] },
            ],
            invoices: [
                { totalAmount: 500, paidAmount: 125 },
                { totalAmount: 100, paidAmount: 100 },
            ],
            collections: [
                { totalAmount: 800, paidAmount: 300 },
                { totalAmount: 50, paidAmount: 50 },
            ],
        });

        expect(result).toEqual({
            waitingToBill: { ownerCount: 2, transactionCount: 3, amount: 170.5 },
            invoiceOutstanding: { documentCount: 1, amount: 375 },
            collectionOutstanding: { documentCount: 1, amount: 500 },
        });
    });

    it('excludes documents closed within the billing settlement tolerance', () => {
        const result = buildBillingOutstandingSummary({
            pendingOwners: [],
            invoices: [{ totalAmount: 100, paidAmount: 99.995 }],
            collections: [{ totalAmount: 100, paidAmount: 99.99 }],
        });

        expect(result.invoiceOutstanding).toEqual({ documentCount: 0, amount: 0 });
        expect(result.collectionOutstanding.documentCount).toBe(1);
        expect(result.collectionOutstanding.amount).toBeCloseTo(0.01, 8);
    });

    it('does not count zero or invalid unbilled totals as waiting owners', () => {
        const result = buildBillingOutstandingSummary({
            pendingOwners: [
                { transactions: [{ amount: 0 }] },
                { transactions: [{ amount: 'bad' }] },
            ],
            invoices: [],
            collections: [],
        });

        expect(result.waitingToBill).toEqual({ ownerCount: 0, transactionCount: 0, amount: 0 });
    });
});
