import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
});

describe('retired Gas Control v1 API family', () => {
    it('checks ADMIN auth before the retired response', async () => {
        requireAdminApiMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { GET } = await import('../src/app/api/admin/gas-control/dashboard/route');
        const response = await GET();
        expect(response.status).toBe(403);
    });

    it.each([
        ['dashboard', 'GET', '../src/app/api/admin/gas-control/dashboard/route'],
        ['gauge-read', 'GET', '../src/app/api/admin/gas-control/gauge/route'],
        ['gauge-write', 'POST', '../src/app/api/admin/gas-control/gauge/route'],
        ['meters-read', 'GET', '../src/app/api/admin/gas-control/meters/route'],
        ['meters-write', 'PUT', '../src/app/api/admin/gas-control/meters/route'],
        ['reports', 'POST', '../src/app/api/admin/gas-control/reports/route'],
        ['shifts', 'GET', '../src/app/api/admin/gas-control/shifts/route'],
    ] as const)('%s %s returns 410', async (_name, method, modulePath) => {
        const route = await import(modulePath);
        const response = await route[method]();
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({ error: 'Legacy Gas Control v1 API retired', retired: true });
    });

    it('removes Prisma/session-cookie logic from all retired route files', () => {
        for (const file of [
            'dashboard/route.ts', 'gauge/route.ts', 'meters/route.ts', 'reports/route.ts', 'shifts/route.ts',
        ]) {
            const source = readFileSync(`src/app/api/admin/gas-control/${file}`, 'utf8');
            expect(source).not.toContain("@/lib/prisma");
            expect(source).not.toContain("next/headers");
            expect(source).toContain('retiredGasControlResponse');
        }
    });

    it('keeps the UI route itself as a server redirect to Gas Control V2', () => {
        const source = readFileSync('src/app/admin/gas-control/page.tsx', 'utf8');
        expect(source).toContain("redirect('/admin/gas')");
    });
});
