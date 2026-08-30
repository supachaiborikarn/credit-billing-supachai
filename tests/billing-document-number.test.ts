import { describe, expect, it } from 'vitest';
import {
    buildBillingCollectionNumberPrefix,
    buildInvoiceNumberPrefix,
} from '../src/lib/billing/document-number';

describe('billing document number date prefixes', () => {
    it('uses Bangkok date across the UTC midnight boundary', () => {
        const bangkokMorning = new Date('2026-08-29T18:30:00.000Z');
        expect(buildInvoiceNumberPrefix(bangkokMorning)).toBe('INV-20260830-');
        expect(buildBillingCollectionNumberPrefix(bangkokMorning)).toBe('BC-2026-08');
    });
});
