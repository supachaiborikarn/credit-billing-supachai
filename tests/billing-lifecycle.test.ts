import { describe, expect, it } from 'vitest';
import {
    BILLING_PIPELINE_STAGES,
    deriveBillingSettlementStage,
    getBillingRemainingAmount,
    isBillingOverdue,
    isBillingStageCurrentlyDerivable,
} from '../src/lib/billing/lifecycle';

describe('billing lifecycle', () => {
    it('keeps the six UX pipeline stages in the agreed order', () => {
        expect(BILLING_PIPELINE_STAGES.map((item) => item.stage)).toEqual([
            'WAITING_TO_BILL',
            'PREPARING_DOCUMENTS',
            'BILLED',
            'AWAITING_PAYMENT',
            'PARTIAL',
            'CLOSED',
        ]);
    });

    it('does not invent preparation or billed signals that are not persisted today', () => {
        expect(isBillingStageCurrentlyDerivable('WAITING_TO_BILL')).toBe(true);
        expect(isBillingStageCurrentlyDerivable('PREPARING_DOCUMENTS')).toBe(false);
        expect(isBillingStageCurrentlyDerivable('BILLED')).toBe(false);
        expect(isBillingStageCurrentlyDerivable('AWAITING_PAYMENT')).toBe(true);
    });

    it('derives settlement stage from amounts instead of trusting stale status strings', () => {
        expect(deriveBillingSettlementStage({ totalAmount: 1000, paidAmount: 0 })).toBe('AWAITING_PAYMENT');
        expect(deriveBillingSettlementStage({ totalAmount: 1000, paidAmount: 250 })).toBe('PARTIAL');
        expect(deriveBillingSettlementStage({ totalAmount: 1000, paidAmount: 1000 })).toBe('CLOSED');
        expect(getBillingRemainingAmount({ totalAmount: 1000, paidAmount: 250 })).toBe(750);
    });

    it('treats overdue as an attention overlay, never as a closed-document stage', () => {
        const now = new Date('2026-08-27T00:00:00.000Z');
        expect(isBillingOverdue({
            totalAmount: 1000,
            paidAmount: 0,
            dueDate: '2026-08-20T00:00:00.000Z',
        }, now)).toBe(true);
        expect(isBillingOverdue({
            totalAmount: 1000,
            paidAmount: 1000,
            dueDate: '2026-08-20T00:00:00.000Z',
        }, now)).toBe(false);
    });
});
