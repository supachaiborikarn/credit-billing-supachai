import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('S133 legacy owner/currentCredit retirement', () => {
    it('retires legacy admin owner list after ADMIN auth', async () => {
        const { GET } = await import('../src/app/api/admin/owners/route');
        const response = await GET(new Request('http://localhost/api/admin/owners?outstanding=true'));
        expect(response.status).toBe(410);
        expect(requireAdminApiMock).toHaveBeenCalledTimes(1);
        await expect(response.json()).resolves.toMatchObject({
            canonicalCustomers: '/customers',
            canonicalBilling: '/billing',
        });
    });

    it('retires legacy admin owner PATCH after ADMIN auth', async () => {
        const { PATCH } = await import('../src/app/api/admin/owners/[id]/route');
        const response = await PATCH(new Request('http://localhost/api/admin/owners/owner-1', {
            method: 'PATCH',
            body: JSON.stringify({ creditLimit: 5000 }),
        }) as never, { params: Promise.resolve({ id: 'owner-1' }) });
        expect(response.status).toBe(410);
        expect(requireAdminApiMock).toHaveBeenCalledTimes(1);
        await expect(response.json()).resolves.toMatchObject({ canonicalOwnerApi: '/api/owners/[id]' });
    });

    it('keeps merge separate while removing currentCredit helpers from credit-service', () => {
        const creditService = readFileSync('src/services/credit-service.ts', 'utf8');
        expect(creditService).not.toContain('updateOwnerCredit');
        expect(creditService).not.toContain('checkCreditLimit');
        expect(creditService).not.toContain('getOwnersWithOutstandingCredit');
        expect(creditService).not.toContain("from '@/lib/prisma'");
        expect(creditService).toContain('generateAllMonthlyInvoices');

        const mergeRoute = readFileSync('src/app/api/admin/owners/merge/route.ts', 'utf8');
        expect(mergeRoute).toContain('export async function POST');
        expect(mergeRoute).toContain("action: 'MERGE'");
    });

    it('server-redirects all retired owner-credit admin pages', () => {
        expect(readFileSync('src/app/admin/owners/page.tsx', 'utf8')).toContain("redirect('/customers')");
        expect(readFileSync('src/app/admin/credit-limit/page.tsx', 'utf8')).toContain("redirect('/customers')");
        expect(readFileSync('src/app/admin/outstanding/page.tsx', 'utf8')).toContain("redirect('/billing')");
    });

    it('removes retired owner routes from Sidebar navigation', () => {
        const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
        expect(sidebar).toContain("href: '/customers'");
        expect(sidebar).not.toContain("href: '/admin/owners'");
        expect(sidebar).not.toContain("href: '/owners'");
    });
});
