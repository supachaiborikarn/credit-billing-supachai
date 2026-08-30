import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    requireAdminApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', stationId: null },
    });
});

describe('retired GAS reconciliation list API', () => {
    it('keeps ADMIN auth before returning retirement metadata', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/v2/gas/admin/reconciliation/route');
        const response = await GET();
        expect(response.status).toBe(403);
    });

    it('returns 410 with the shift-report replacement while keeping per-shift PUT separate', async () => {
        const { GET } = await import('../src/app/api/v2/gas/admin/reconciliation/route');
        const response = await GET();
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({
            error: 'Reconciliation list moved to GAS shift report',
            retired: true,
            reportPath: '/admin/gas/reports/shift?view=reconciliation',
            editApiPattern: '/api/v2/gas/admin/reconciliation/[shiftId]',
        });
    });

    it('removes analytics/database reads from the retired list route', () => {
        const source = readFileSync('src/app/api/v2/gas/admin/reconciliation/route.ts', 'utf8');
        expect(source).not.toContain("@/lib/prisma");
        expect(source).not.toContain('getGasShiftAnalyticsData');
        expect(source).not.toContain('shift.findMany');
    });
});

describe('GAS reconciliation replacement surface', () => {
    it('keeps the old page only as a reference while the active route redirects to shift report mode', () => {
        const activePage = readFileSync('src/app/admin/gas/reconciliation/page.tsx', 'utf8');
        const legacyPage = readFileSync('src/app/admin/gas/reconciliation/LegacyGasReconciliationPage.tsx', 'utf8');
        expect(activePage).toContain("params.set('view', 'reconciliation')");
        expect(activePage).toContain('redirect(`/admin/gas/reports/shift?');
        expect(legacyPage).toContain('/api/v2/gas/admin/reconciliation?');
    });

    it('moves reconciliation filters, summary, note editing and deep-link edit into Shift Report', () => {
        const source = readFileSync('src/app/admin/gas/reports/shift/page.tsx', 'utf8');
        expect(source).toContain("params.get('view') === 'reconciliation'");
        expect(source).toContain("params.get('editShiftId')");
        expect(source).toContain("params.get('status')");
        expect(source).toContain('reconciliationSummary');
        expect(source).toContain('varianceFilter');
        expect(source).toContain('varianceNote: editForm.varianceNote');
        expect(source).toContain('/api/v2/gas/admin/reconciliation/${selectedShift.id}');
    });

    it('points meter-report reconciliation edits and navigation to the consolidated Shift Report', () => {
        const meterReport = readFileSync('src/app/admin/gas/reports/meters/page.tsx', 'utf8');
        const layout = readFileSync('src/app/admin/gas/layout.tsx', 'utf8');
        const shell = readFileSync('src/components/layout/RedesignAppShell.tsx', 'utf8');
        expect(meterReport).toContain("params.set('view', 'reconciliation')");
        expect(meterReport).toContain('/admin/gas/reports/shift?${params}');
        expect(layout).toContain('/admin/gas/reports/shift?view=reconciliation');
        expect(shell).toContain('/admin/gas/reports/shift?view=reconciliation');
    });
});
