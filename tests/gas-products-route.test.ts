import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    station: { upsert: vi.fn() },
    productInventory: { findMany: vi.fn() },
};
const requireGasStationAccessMock = vi.fn();
const requireGasProductsEnabledMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
    requireGasProductsEnabled: requireGasProductsEnabledMock,
}));
vi.mock('@/lib/gas/payment-utils', () => ({ normalizeGasPaymentType: vi.fn(() => 'CASH') }));

beforeEach(() => {
    prismaMock.station.upsert.mockReset();
    prismaMock.productInventory.findMany.mockReset();
    requireGasStationAccessMock.mockReset();
    requireGasProductsEnabledMock.mockReset();
    requireGasStationAccessMock.mockResolvedValue({
        station: { dbId: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์' },
        user: { id: 'staff-5', role: 'STAFF' },
    });
    requireGasProductsEnabledMock.mockReturnValue(null);
});

describe('gas products route', () => {
    it('keeps GET read-only and returns station-scoped inventory', async () => {
        prismaMock.productInventory.findMany.mockResolvedValue([
            {
                id: 'inv-1',
                productId: 'product-1',
                product: { id: 'product-1', name: 'น้ำ', unit: 'ขวด', salePrice: 10, costPrice: 5 },
                quantity: 12,
                alertLevel: 3,
            },
        ]);

        const { GET } = await import('../src/app/api/gas-station/[id]/products/route');
        const response = await GET(new Request('http://localhost/api/gas-station/5/products'), { params: Promise.resolve({ id: '5' }) });

        expect(response.status).toBe(200);
        expect(prismaMock.station.upsert).not.toHaveBeenCalled();
        expect(prismaMock.productInventory.findMany).toHaveBeenCalledWith({
            where: { stationId: 'station-5' },
            include: { product: true },
        });
        await expect(response.json()).resolves.toEqual([
            expect.objectContaining({ id: 'inv-1', quantity: 12, product: expect.objectContaining({ salePrice: 10, costPrice: 5 }) }),
        ]);
    });

    it('returns the product capability guard before reading inventory', async () => {
        const blocked = new Response(JSON.stringify({ error: 'disabled' }), { status: 403, headers: { 'content-type': 'application/json' } });
        requireGasProductsEnabledMock.mockReturnValue(blocked);
        const { GET } = await import('../src/app/api/gas-station/[id]/products/route');
        const response = await GET(new Request('http://localhost/api/gas-station/6/products'), { params: Promise.resolve({ id: '6' }) });
        expect(response.status).toBe(403);
        expect(prismaMock.productInventory.findMany).not.toHaveBeenCalled();
    });
});
