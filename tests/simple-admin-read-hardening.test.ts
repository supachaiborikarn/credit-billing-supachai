import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiMock = vi.fn();
const getOperationalSalesDatasetMock = vi.fn();
const transactionGroupByMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/operational-sales', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/lib/operational-sales')>();
    return { ...original, getOperationalSalesDataset: getOperationalSalesDatasetMock };
});
vi.mock('@/lib/prisma', () => ({
    prisma: { transaction: { groupBy: transactionGroupByMock } },
}));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    getOperationalSalesDatasetMock.mockReset();
    transactionGroupByMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    getOperationalSalesDatasetMock.mockResolvedValue({ rows: [], watcharaExternal: undefined });
    transactionGroupByMock.mockResolvedValue([]);
});

describe('SIMPLE admin read contracts', () => {
    it.each([
        ['overview', async () => (await import('../src/app/api/v2/simple/admin/overview/route')).GET()],
        ['stations', async () => (await import('../src/app/api/v2/simple/admin/stations/route')).GET(new NextRequest('http://localhost/api/v2/simple/admin/stations'))],
        ['fuel-time', async () => (await import('../src/app/api/v2/simple/admin/fuel-time/route')).GET(new NextRequest('http://localhost/api/v2/simple/admin/fuel-time'))],
        ['analytics', async () => (await import('../src/app/api/v2/simple/admin/analytics/route')).GET(new NextRequest('http://localhost/api/v2/simple/admin/analytics'))],
    ])('blocks %s before querying report data when caller is not ADMIN', async (_name, callRoute) => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const response = await callRoute();
        expect(response.status).toBe(403);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
        expect(transactionGroupByMock).not.toHaveBeenCalled();
    });

    it.each(['0', '91', '7x', '-1'])('rejects invalid station-performance days=%s', async (days) => {
        const { GET } = await import('../src/app/api/v2/simple/admin/stations/route');
        const response = await GET(new NextRequest(`http://localhost/api/v2/simple/admin/stations?days=${days}`));
        expect(response.status).toBe(400);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
    });

    it.each(['0', '999', 'abc'])('rejects invalid fuel-time days=%s', async (days) => {
        const { GET } = await import('../src/app/api/v2/simple/admin/fuel-time/route');
        const response = await GET(new NextRequest(`http://localhost/api/v2/simple/admin/fuel-time?days=${days}`));
        expect(response.status).toBe(400);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
    });

    it('rejects non-SIMPLE station scope in fuel-time', async () => {
        const { GET } = await import('../src/app/api/v2/simple/admin/fuel-time/route');
        const response = await GET(new NextRequest('http://localhost/api/v2/simple/admin/fuel-time?stationId=station-5'));
        expect(response.status).toBe(400);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
    });

    it('rejects FULL analytics mode and non-SIMPLE station before data access', async () => {
        const { GET } = await import('../src/app/api/v2/simple/admin/analytics/route');
        const fullResponse = await GET(new NextRequest('http://localhost/api/v2/simple/admin/analytics?type=FULL'));
        expect(fullResponse.status).toBe(400);
        const stationResponse = await GET(new NextRequest('http://localhost/api/v2/simple/admin/analytics?type=SIMPLE&stationId=station-5'));
        expect(stationResponse.status).toBe(400);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
        expect(transactionGroupByMock).not.toHaveBeenCalled();
    });

    it('accepts bounded SIMPLE report filters', async () => {
        const { GET: getStations } = await import('../src/app/api/v2/simple/admin/stations/route');
        const stationsResponse = await getStations(new NextRequest('http://localhost/api/v2/simple/admin/stations?days=90'));
        expect(stationsResponse.status).toBe(200);
        expect(getOperationalSalesDatasetMock).toHaveBeenCalledWith(expect.objectContaining({
            stationIds: ['station-2', 'station-3', 'station-4'],
        }));
    });
});
