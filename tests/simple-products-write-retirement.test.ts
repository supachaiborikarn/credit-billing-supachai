import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStationAccessApiMock = vi.fn();
const inventoryFindManyMock = vi.fn();
const productCreateMock = vi.fn();
const productUpdateMock = vi.fn();
const inventoryCreateMock = vi.fn();
const inventoryUpdateManyMock = vi.fn();
const inventoryDeleteManyMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        product: { create: productCreateMock, update: productUpdateMock },
        productInventory: {
            findMany: inventoryFindManyMock,
            create: inventoryCreateMock,
            updateMany: inventoryUpdateManyMock,
            deleteMany: inventoryDeleteManyMock,
        },
    },
}));

beforeEach(() => {
    requireStationAccessApiMock.mockReset();
    inventoryFindManyMock.mockReset();
    productCreateMock.mockReset();
    productUpdateMock.mockReset();
    inventoryCreateMock.mockReset();
    inventoryUpdateManyMock.mockReset();
    inventoryDeleteManyMock.mockReset();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', stationId: null },
    });
    inventoryFindManyMock.mockResolvedValue([]);
});

function mutationCalls() {
    return [productCreateMock, productUpdateMock, inventoryCreateMock, inventoryUpdateManyMock, inventoryDeleteManyMock];
}

describe('retired SIMPLE product mutations', () => {
    it('keeps GET as station-scoped read compatibility', async () => {
        const { GET } = await import('../src/app/api/simple-station/[id]/products/route');
        const response = await GET(
            new Request('http://localhost/api/simple-station/station-2/products') as never,
            { params: Promise.resolve({ id: 'station-2' }) },
        );
        expect(response.status).toBe(200);
        expect(requireStationAccessApiMock).toHaveBeenCalledWith('station-2');
        expect(inventoryFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { stationId: 'station-2' } }));
    });

    it('checks station access before mutation retirement metadata', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/simple-station/[id]/products/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/2/products', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(403);
        for (const fn of mutationCalls()) expect(fn).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PUT', 'DELETE'] as const)('%s returns 410 without a product/inventory mutation', async (method) => {
        const route = await import('../src/app/api/simple-station/[id]/products/route');
        const response = await route[method](
            new Request('http://localhost/api/simple-station/2/products', { method }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Legacy SIMPLE product write API retired',
            retired: true,
            replacement: '/stations/station-2/history',
        });
        for (const fn of mutationCalls()) expect(fn).not.toHaveBeenCalled();
    });

    it('points station-1 legacy mutations to canonical Overview', async () => {
        const { PUT } = await import('../src/app/api/simple-station/[id]/products/route');
        const response = await PUT(
            new Request('http://localhost/api/simple-station/1/products', { method: 'PUT' }) as never,
            { params: Promise.resolve({ id: '1' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({ replacement: '/stations/station-1' });
        for (const fn of mutationCalls()) expect(fn).not.toHaveBeenCalled();
    });
});
