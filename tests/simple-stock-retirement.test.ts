import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));

beforeEach(() => {
    requireAdminApiMock.mockReset();
});

describe('retired SIMPLE stock mock', () => {
    it('checks ADMIN auth before returning the retirement response', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/v2/simple/admin/stock/route');
        const response = await GET();
        expect(response.status).toBe(403);
        expect(requireAdminApiMock).toHaveBeenCalledTimes(1);
    });

    it('returns 410 for an authenticated ADMIN instead of randomized tank data', async () => {
        requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
        const { GET } = await import('../src/app/api/v2/simple/admin/stock/route');
        const response = await GET();
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            retired: true,
            overviewPath: '/admin/simple',
        });
    });

    it('removes mock/random stock generation and the SIMPLE stock navigation entry', () => {
        const apiSource = readFileSync('src/app/api/v2/simple/admin/stock/route.ts', 'utf8');
        const pageSource = readFileSync('src/app/admin/simple/stock/page.tsx', 'utf8');
        const layoutSource = readFileSync('src/app/admin/simple/layout.tsx', 'utf8');
        expect(apiSource).not.toContain('Math.random');
        expect(apiSource).not.toContain('mockTanks');
        expect(pageSource).toContain("redirect(`/admin/simple");
        expect(layoutSource).not.toContain("href: '/admin/simple/stock'");
    });
});
