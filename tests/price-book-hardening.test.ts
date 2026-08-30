import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    authAdmin: vi.fn(),
    authSession: vi.fn(),
    fuelProductFindMany: vi.fn(),
    priceBookCreate: vi.fn(),
    priceBookFindUnique: vi.fn(),
    priceBookFindMany: vi.fn(),
    priceBookFindFirst: vi.fn(),
    priceBookUpdate: vi.fn(),
    priceBookDelete: vi.fn(),
    lineDeleteMany: vi.fn(),
    lineCreateMany: vi.fn(),
    auditCreate: vi.fn(),
}));

const tx = {
    fuelProduct: { findMany: mocks.fuelProductFindMany },
    priceBook: {
        create: mocks.priceBookCreate,
        findUnique: mocks.priceBookFindUnique,
        update: mocks.priceBookUpdate,
        delete: mocks.priceBookDelete,
    },
    priceBookLine: {
        deleteMany: mocks.lineDeleteMany,
        createMany: mocks.lineCreateMany,
    },
    auditLog: { create: mocks.auditCreate },
};

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: mocks.transaction,
        priceBook: {
            findMany: mocks.priceBookFindMany,
            findUnique: mocks.priceBookFindUnique,
            findFirst: mocks.priceBookFindFirst,
        },
    },
}));

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: mocks.authAdmin,
    requireApiSession: mocks.authSession,
}));

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown, options: unknown) => {
        void options;
        return callback(tx);
    });
    mocks.authAdmin.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    mocks.authSession.mockResolvedValue({ user: { id: 'staff-5', role: 'STAFF', stationId: 'station-5' } });
    mocks.fuelProductFindMany.mockResolvedValue([{ id: 'fuel-1' }]);
    mocks.priceBookCreate.mockResolvedValue({ id: 'pb-1', lines: [] });
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' });
});

describe('PriceBook validation contract', () => {
    it('canonicalizes configured aliases and blocks retired stations for new books', async () => {
        const { normalizeConfiguredStationId } = await import('../src/services/price-book-admin-service');
        expect(normalizeConfiguredStationId('d01b9c7b-fcf0-4185-a0b1-a5840391a61c', true)).toBe('station-5');
        expect(normalizeConfiguredStationId('station-2', false)).toBe('station-2');
        expect(normalizeConfiguredStationId('station-2', true)).toBeUndefined();
        expect(normalizeConfiguredStationId('unknown', false)).toBeUndefined();
    });

    it('rejects impossible dates, duplicate products, and non-positive prices', async () => {
        const { parsePriceBookDate, parsePriceBookLines } = await import('../src/services/price-book-admin-service');
        expect(parsePriceBookDate('2026-02-31')).toBeUndefined();
        expect(parsePriceBookDate('2026-08-31T00:00:00+07:00')).toBeInstanceOf(Date);
        expect(parsePriceBookLines([{ productId: 'fuel-1', pricePerUnit: 30 }])).toEqual([
            { productId: 'fuel-1', pricePerUnit: 30 },
        ]);
        expect(parsePriceBookLines([
            { productId: 'fuel-1', pricePerUnit: 30 },
            { productId: 'fuel-1', pricePerUnit: 31 },
        ])).toBeUndefined();
        expect(parsePriceBookLines([{ productId: 'fuel-1', pricePerUnit: 0 }])).toBeUndefined();
    });
});

describe('PriceBook atomic admin mutations', () => {
    it('creates line PriceBook and AuditLog in one bounded transaction', async () => {
        const { createLinePriceBook } = await import('../src/services/price-book-admin-service');
        const result = await createLinePriceBook({
            stationId: 'station-1',
            effectiveFrom: new Date('2026-08-31T00:00:00Z'),
            effectiveTo: null,
            lines: [{ productId: 'fuel-1', pricePerUnit: 31.25 }],
            userId: 'admin-1',
        });
        expect(result.success).toBe(true);
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
        expect(mocks.priceBookCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stationId: 'station-1', status: 'DRAFT', createdById: 'admin-1' }),
        }));
        expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'CREATE', model: 'PriceBook', recordId: 'pb-1' }),
        }));
    });

    it('fails closed when an active FuelProduct is missing', async () => {
        mocks.fuelProductFindMany.mockResolvedValue([]);
        const { createLinePriceBook } = await import('../src/services/price-book-admin-service');
        const result = await createLinePriceBook({
            stationId: null,
            effectiveFrom: new Date('2026-08-31T00:00:00Z'),
            effectiveTo: null,
            lines: [{ productId: 'missing', pricePerUnit: 30 }],
            userId: 'admin-1',
        });
        expect(result).toEqual({ success: false, status: 400, error: 'พบประเภทเชื้อเพลิงที่ไม่มีหรือปิดใช้งาน' });
        expect(mocks.priceBookCreate).not.toHaveBeenCalled();
        expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it('refuses to mutate scalar price-service rows through the line API', async () => {
        mocks.priceBookFindUnique.mockResolvedValueOnce({
            id: 'scalar-1', stationId: 'station-1', productType: 'DIESEL', retailPrice: 31,
            wholesalePrice: 30, effectiveFrom: new Date(), effectiveTo: null, status: 'DRAFT', lines: [],
        });
        const { updateLinePriceBook } = await import('../src/services/price-book-admin-service');
        const result = await updateLinePriceBook({ id: 'scalar-1', status: 'ACTIVE', userId: 'admin-1' });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.status).toBe(409);
        expect(mocks.priceBookUpdate).not.toHaveBeenCalled();
        expect(mocks.lineDeleteMany).not.toHaveBeenCalled();
        expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it('replaces line data and writes UPDATE audit inside the same transaction', async () => {
        mocks.priceBookFindUnique
            .mockResolvedValueOnce({
                id: 'pb-1', stationId: 'station-1', productType: null, retailPrice: null,
                wholesalePrice: null, effectiveFrom: new Date('2026-08-01T00:00:00Z'),
                effectiveTo: null, status: 'DRAFT', lines: [{ productId: 'fuel-1', pricePerUnit: 30 }],
            })
            .mockResolvedValueOnce({ id: 'pb-1', status: 'ACTIVE', lines: [] });
        const { updateLinePriceBook } = await import('../src/services/price-book-admin-service');
        const result = await updateLinePriceBook({
            id: 'pb-1', status: 'ACTIVE', lines: [{ productId: 'fuel-1', pricePerUnit: 31 }], userId: 'admin-1',
        });
        expect(result.success).toBe(true);
        expect(mocks.lineDeleteMany).toHaveBeenCalledWith({ where: { priceBookId: 'pb-1' } });
        expect(mocks.lineCreateMany).toHaveBeenCalled();
        expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'UPDATE', model: 'PriceBook', recordId: 'pb-1' }),
        }));
    });

    it('deletes only DRAFT line books and audits the deletion atomically', async () => {
        mocks.priceBookFindUnique.mockResolvedValueOnce({
            id: 'pb-1', stationId: null, productType: null, retailPrice: null, wholesalePrice: null,
            effectiveFrom: new Date('2026-08-01T00:00:00Z'), effectiveTo: null, status: 'DRAFT',
            lines: [{ productId: 'fuel-1', pricePerUnit: 30 }],
        });
        const { deleteLinePriceBook } = await import('../src/services/price-book-admin-service');
        const result = await deleteLinePriceBook({ id: 'pb-1', userId: 'admin-1' });
        expect(result.success).toBe(true);
        expect(mocks.lineDeleteMany).toHaveBeenCalledWith({ where: { priceBookId: 'pb-1' } });
        expect(mocks.priceBookDelete).toHaveBeenCalledWith({ where: { id: 'pb-1' } });
        expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'DELETE', model: 'PriceBook', recordId: 'pb-1' }),
        }));
    });
});

describe('PriceBook route access and scope', () => {
    it('protects active PriceBook reads with session auth', async () => {
        mocks.authSession.mockResolvedValue({ response: new Response('{}', { status: 401 }) });
        const { GET } = await import('../src/app/api/price-books/active/route');
        const response = await GET(new Request('http://localhost/api/price-books/active?stationId=station-5'));
        expect(response.status).toBe(401);
        expect(mocks.priceBookFindFirst).not.toHaveBeenCalled();
    });

    it('blocks STAFF from reading another station active PriceBook', async () => {
        const { GET } = await import('../src/app/api/price-books/active/route');
        const response = await GET(new Request('http://localhost/api/price-books/active?stationId=station-6'));
        expect(response.status).toBe(403);
        expect(mocks.priceBookFindFirst).not.toHaveBeenCalled();
    });

    it('rejects retired-station PriceBook creation before transaction', async () => {
        const { POST } = await import('../src/app/api/price-books/route');
        const response = await POST(new Request('http://localhost/api/price-books', {
            method: 'POST',
            body: JSON.stringify({
                stationId: 'station-2',
                effectiveFrom: '2026-08-31',
                lines: [{ productId: 'fuel-1', pricePerUnit: 30 }],
            }),
        }));
        expect(response.status).toBe(400);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('rejects invalid root list filters before Prisma read', async () => {
        const { GET } = await import('../src/app/api/price-books/route');
        const response = await GET(new Request('http://localhost/api/price-books?stationId=unknown&status=BAD'));
        expect(response.status).toBe(400);
        expect(mocks.priceBookFindMany).not.toHaveBeenCalled();
    });
});
