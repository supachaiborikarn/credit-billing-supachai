import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
});

describe('retired legacy GAS history API', () => {
    it('keeps ADMIN auth before returning the retired response', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/admin/gas-history/route');
        const response = await GET();
        expect(response.status).toBe(403);
    });

    it.each(['GET', 'POST', 'DELETE'] as const)('%s fails closed with replacement paths and no legacy mutation', async (method) => {
        const route = await import('../src/app/api/admin/gas-history/route');
        const response = await route[method]();
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({
            error: 'Legacy GAS history API retired',
            retired: true,
            readPath: '/admin/gas/reports/daily',
            editPath: '/admin/gas/data-entry',
            operationsPath: '/admin/gas/operations',
        });
    });

    it('removes the old GET-side Station creation and legacy write implementation', () => {
        const source = readFileSync('src/app/api/admin/gas-history/route.ts', 'utf8');
        expect(source).not.toContain("@/lib/prisma");
        expect(source).not.toContain('getDbStation');
        expect(source).not.toContain('station.create');
        expect(source).not.toContain('dailyRecord.create');
        expect(source).not.toContain('meterReading.update');
    });
});

describe('GAS history replacement surfaces', () => {
    it('keeps the old UI source only as a legacy reference while the active page redirects', () => {
        const activePage = readFileSync('src/app/admin/gas-history/page.tsx', 'utf8');
        const legacyPage = readFileSync('src/app/admin/gas-history/LegacyGasHistoryAdminPage.tsx', 'utf8');
        expect(activePage).toContain("redirect(`/admin/gas/reports/daily");
        expect(legacyPage).toContain("fetch(`/api/admin/gas-history?");
    });

    it('hydrates the modern daily report from both new and legacy bookmark filters', () => {
        const source = readFileSync('src/app/admin/gas/reports/daily/page.tsx', 'utf8');
        expect(source).toContain("searchParams.get('stationId')");
        expect(source).toContain("searchParams.get('from') || searchParams.get('startDate')");
        expect(source).toContain("searchParams.get('to') || searchParams.get('endDate')");
    });

    it('points canonical GAS History ADMIN fallback to the modern report instead of gas-history', () => {
        const source = readFileSync('src/components/stations/StationHistory.tsx', 'utf8');
        expect(source).toContain('/admin/gas/reports/daily?stationId=');
        expect(source).not.toContain('/admin/gas-history');
        expect(source).toContain("context.user.role === 'ADMIN'");
    });
});
