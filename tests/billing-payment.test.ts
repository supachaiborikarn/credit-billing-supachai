import { describe, expect, it, vi } from 'vitest';
import {
    BillingPaymentError,
    submitBillingReceivePayment,
    validateBillingReceivePayment,
} from '../src/lib/billing/payment';

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('billing payment adapter', () => {
    it('rejects overpayment before calling an API', async () => {
        expect(validateBillingReceivePayment({
            kind: 'INVOICE',
            documentId: 'inv-1',
            amount: 1001,
            remainingAmount: 1000,
        })).toContain('เกินยอดคงเหลือ');
    });

    it('posts Invoice payment only to the atomic invoice payment endpoint', async () => {
        const fetchImpl = vi.fn(async (input: string) => {
            expect(input).toBe('/api/invoices/inv-1/payments');
            return jsonResponse({ id: 'pay-1' });
        });

        const result = await submitBillingReceivePayment({
            kind: 'INVOICE',
            documentId: 'inv-1',
            amount: 500,
            remainingAmount: 1000,
            paymentMethod: 'TRANSFER',
            notes: 'partial',
        }, fetchImpl);

        expect(result.state).toBe('CONFIRMED');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('requires evidence for BillingCollection and creates a pending slip after upload', async () => {
        const file = new File(['fake-image'], 'slip.png', { type: 'image/png' });
        const calls: string[] = [];
        const fetchImpl = vi.fn(async (input: string) => {
            calls.push(input);
            if (input === '/api/upload/transfer-proof') {
                return jsonResponse({ url: 'https://example.com/slip.webp' });
            }
            if (input === '/api/billing-collections/bc-1/payment-slips') {
                return jsonResponse({ id: 'slip-1', status: 'PENDING' }, 201);
            }
            return jsonResponse({ error: 'unexpected' }, 500);
        });

        const result = await submitBillingReceivePayment({
            kind: 'BILLING_COLLECTION',
            documentId: 'bc-1',
            amount: 400,
            remainingAmount: 1000,
            evidenceFile: file,
        }, fetchImpl);

        expect(result.state).toBe('PENDING_REVIEW');
        expect(calls).toEqual([
            '/api/upload/transfer-proof',
            '/api/billing-collections/bc-1/payment-slips',
        ]);
    });

    it('does not create a collection slip when evidence upload fails', async () => {
        const file = new File(['fake-image'], 'slip.png', { type: 'image/png' });
        const fetchImpl = vi.fn(async () => jsonResponse({ error: 'upload failed' }, 500));

        await expect(submitBillingReceivePayment({
            kind: 'BILLING_COLLECTION',
            documentId: 'bc-1',
            amount: 400,
            remainingAmount: 1000,
            evidenceFile: file,
        }, fetchImpl)).rejects.toBeInstanceOf(BillingPaymentError);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});
