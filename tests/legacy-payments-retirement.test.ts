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

describe('legacy /api/payments retirement', () => {
    it('checks ADMIN auth before POST retirement metadata', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/payments/route');
        const response = await POST(new Request('http://localhost/api/payments', { method: 'POST' }));
        expect(response.status).toBe(403);
    });

    it('checks session auth before GET retirement metadata', async () => {
        requireApiSessionMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        });
        const { GET } = await import('../src/app/api/payments/route');
        const response = await GET(new Request('http://localhost/api/payments'));
        expect(response.status).toBe(401);
    });

    it.each(['GET', 'POST'] as const)('%s returns 410 with canonical Billing replacements', async (method) => {
        const route = await import('../src/app/api/payments/route');
        const response = await route[method](new Request('http://localhost/api/payments', { method }));
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Legacy payment API retired',
            retired: true,
            replacements: {
                billingWorkspace: '/billing',
                invoicePaymentApi: '/api/invoices/[invoiceId]/payments',
            },
        });
    });

    it('contains no legacy Prisma payment/Invoice/currentCredit mutation path', () => {
        const source = readFileSync('src/app/api/payments/route.ts', 'utf8');
        expect(source).not.toContain("@/lib/prisma");
        expect(source).not.toContain('updateOwnerCredit');
        expect(source).not.toContain('prisma.payment.create');
        expect(source).not.toContain('prisma.invoice.update');
        expect(source).toContain('/api/invoices/[invoiceId]/payments');
    });
});
