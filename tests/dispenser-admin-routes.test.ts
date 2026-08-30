import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const requireStationAccessApiMock = vi.fn();
const createDispenserAdminMock = vi.fn();
const prismaMock = { fuelProduct: { findMany: vi.fn() }, dispenser: { findMany: vi.fn(), findFirst: vi.fn() } };

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
    requireStationAccessApi: requireStationAccessApiMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/dispenser-admin-service', () => ({
    createDispenserAdmin: createDispenserAdminMock,
    updateDispenserAdmin: vi.fn(),
    deleteDispenserAdmin: vi.fn(),
    createNozzleAdmin: vi.fn(),
    updateNozzleAdmin: vi.fn(),
    deleteNozzleAdmin: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
    requireStationAccessApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('S122 dispenser admin routes', () => {
    it('blocks non-admin dispenser creation before service execution', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { POST } = await import('../src/app/api/stations/[stationId]/dispensers/route');
        const response = await POST(new Request('http://localhost/api/stations/station-1/dispensers', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'D1' }),
        }), { params: Promise.resolve({ stationId: 'station-1' }) });
        expect(response.status).toBe(403);
        expect(createDispenserAdminMock).not.toHaveBeenCalled();
    });

    it('rejects malformed dispenser bodies before service execution', async () => {
        const { POST } = await import('../src/app/api/stations/[stationId]/dispensers/route');
        const response = await POST(new Request('http://localhost/api/stations/station-1/dispensers', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad',
        }), { params: Promise.resolve({ stationId: 'station-1' }) });
        expect(response.status).toBe(400);
        expect(createDispenserAdminMock).not.toHaveBeenCalled();
    });

    it('maps retired-station service refusal to 400', async () => {
        createDispenserAdminMock.mockResolvedValueOnce({ success: false, code: 'INVALID_STATION', error: 'retired' });
        const { POST } = await import('../src/app/api/stations/[stationId]/dispensers/route');
        const response = await POST(new Request('http://localhost/api/stations/station-2/dispensers', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'D1' }),
        }), { params: Promise.resolve({ stationId: 'station-2' }) });
        expect(response.status).toBe(400);
        expect(createDispenserAdminMock).toHaveBeenCalledWith({ stationId: 'station-2', code: 'D1', nozzles: [], userId: 'admin-1' });
    });

    it('protects FuelProduct selector with ADMIN auth', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { GET } = await import('../src/app/api/fuel-products/route');
        const blocked = await GET();
        expect(blocked.status).toBe(403);
        expect(prismaMock.fuelProduct.findMany).not.toHaveBeenCalled();

        requireAdminApiMock.mockResolvedValueOnce({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
        prismaMock.fuelProduct.findMany.mockResolvedValueOnce([{ id: 'fuel-1', name: 'Diesel', code: 'DSL' }]);
        const allowed = await GET();
        expect(allowed.status).toBe(200);
        expect(prismaMock.fuelProduct.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });

    it('shows only active station choices in the Dispenser admin UI', async () => {
        const { readFile } = await import('node:fs/promises');
        const source = await readFile('src/app/admin/dispensers/page.tsx', 'utf8');
        expect(source).toContain("operationalStatus === 'ACTIVE'");
        expect(source).toContain('ACTIVE_STATIONS.map');
        expect(source).not.toContain('{STATIONS.map(station => (');
    });
});
