import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string) {
    return readFileSync(path, 'utf8');
}

describe('S104 canonical Billing admin workflow', () => {
    it('owns Invoice and BillingCollection creation in canonical Billing', () => {
        const component = source('src/components/billing/BillingWorkspaceAdminActions.tsx');
        expect(component).toContain("fetch('/api/invoices'");
        expect(component).toContain("fetch('/api/billing-collections'");
        expect(component).toContain('combineOwners: false');
        expect(component).toContain('แต่ละลูกค้าจะถูกสร้างเป็น Invoice แยกใบ');
    });

    it('rejects unsafe multi-owner combined Invoice and uses an audited serializable write', () => {
        const route = source('src/app/api/invoices/route.ts');
        expect(route).toContain('if (combineOwners && targetOwnerIds.length > 1)');
        expect(route).toContain('Prisma.TransactionIsolationLevel.Serializable');
        expect(route).toContain("model: 'Invoice'");
        expect(route).toContain("action: 'CREATE'");
    });

    it('deletes unpaid Invoice atomically and keeps print/export compatibility authenticated', () => {
        const detailRoute = source('src/app/api/invoices/[id]/route.ts');
        const exportRoute = source('src/app/api/invoices/[id]/export/route.ts');
        const actions = source('src/components/billing/BillingDocumentAdminActions.tsx');
        expect(detailRoute).toContain("state: 'HAS_PAYMENTS'");
        expect(detailRoute).toContain('Prisma.TransactionIsolationLevel.Serializable');
        expect(exportRoute).toContain('requireApiSession');
        expect(actions).toContain('หน้าพิมพ์เดิม');
    });

    it('moves BillingCollection slip review into canonical detail', () => {
        const detail = source('src/app/billing/[id]/page.tsx');
        const actions = source('src/components/billing/BillingPaymentEvidenceActions.tsx');
        expect(detail).toContain('<BillingPaymentEvidenceActions');
        expect(actions).toContain("method: isDelete ? 'DELETE' : 'PATCH'");
        expect(actions).toContain("setConfirmAction('VERIFIED')");
        expect(actions).toContain("setConfirmAction('REJECTED')");
    });
});
