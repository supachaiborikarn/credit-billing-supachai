import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GAS executive billing source', () => {
    it('uses canonical billing buckets and never reads legacy currentCredit', () => {
        const route = readFileSync('src/app/api/v2/gas/admin/executive/route.ts', 'utf8');
        const page = readFileSync('src/app/admin/gas/executive/page.tsx', 'utf8');

        expect(route).toContain('buildBillingOutstandingSummary');
        expect(route).toContain('CREDIT_PAYMENT_TYPES');
        expect(route).not.toContain('currentCredit');
        expect(page).toContain('combinedOutstandingSuppressed');
        expect(page).not.toContain('totalOutstanding');
        expect(page).not.toContain('topDebtors');
    });
});
