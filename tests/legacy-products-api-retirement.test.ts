import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireAdminApiMock = vi.fn();
const requireApiSessionMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
    requireApiSession: requireApiSessionMock,
}));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    requireApiSessionMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    requireApiSessionMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
});

describe('legacy global Product API retirement', () => {
    it('keeps session auth before GET retirement metadata', async () => {
        requireApiSessionMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        });
        const { GET } = await import('../src/app/api/products/route');
        expect((await GET()).status).toBe(401);
    });

    it('keeps ADMIN auth before POST retirement metadata', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/products/route');
        expect((await POST(new Request('http://localhost/api/products', { method: 'POST' }))).status).toBe(403);
    });

    it('returns 410 with canonical station-5 Inventory replacements', async () => {
        const { GET, POST } = await import('../src/app/api/products/route');
        for (const response of [
            await GET(),
            await POST(new Request('http://localhost/api/products', { method: 'POST' })),
        ]) {
            expect(response.status).toBe(410);
            await expect(response.json()).resolves.toMatchObject({
                error: 'Legacy global Product API retired',
                retired: true,
                replacements: {
                    canonicalInventory: '/stations/station-5/inventory',
                    stationProductApi: '/api/gas-station/5/products',
                },
            });
        }
    });

    it('contains no global Product Prisma read/write implementation', () => {
        const source = readFileSync('src/app/api/products/route.ts', 'utf8');
        expect(source).not.toContain("@/lib/prisma");
        expect(source).not.toContain('prisma.product.findMany');
        expect(source).not.toContain('prisma.product.create');
        expect(source).toContain('/stations/station-5/inventory');
    });
});
