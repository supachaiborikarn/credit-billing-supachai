import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const generateAllMonthlyInvoicesMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/services/monthly-invoice-service', () => ({
    generateAllMonthlyInvoices: generateAllMonthlyInvoicesMock,
}));

function request(body: unknown) {
    return new Request('http://localhost/api/admin/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('monthly invoice batch route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminApiMock.mockResolvedValue({
            response: null,
            user: { id: 'admin-1', name: 'Admin', role: 'ADMIN' },
        });
        generateAllMonthlyInvoicesMock.mockResolvedValue({ total: 1, created: 1, skipped: 0, errors: 0 });
    });

    it('requires ADMIN before batch generation', async () => {
        requireAdminApiMock.mockResolvedValueOnce({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/admin/invoices/generate/route');
        const response = await POST(request({ month: 8, year: 2026 }));

        expect(response.status).toBe(403);
        expect(generateAllMonthlyInvoicesMock).not.toHaveBeenCalled();
    });

    it.each([
        [{ month: 0, year: 2026 }, 'เดือน'],
        [{ month: 13, year: 2026 }, 'เดือน'],
        [{ month: 8, year: 1999 }, 'ปี'],
    ])('rejects invalid period %j', async (body, expectedError) => {
        const { POST } = await import('../src/app/api/admin/invoices/generate/route');
        const response = await POST(request(body));
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toContain(expectedError);
        expect(generateAllMonthlyInvoicesMock).not.toHaveBeenCalled();
    });

    it('passes the authenticated admin id into the audited batch service', async () => {
        const { POST } = await import('../src/app/api/admin/invoices/generate/route');
        const response = await POST(request({ month: 8, year: 2026 }));

        expect(response.status).toBe(200);
        expect(generateAllMonthlyInvoicesMock).toHaveBeenCalledWith(8, 2026, 'admin-1');
    });
});
