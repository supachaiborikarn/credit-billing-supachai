import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    station: { findUnique: vi.fn() },
    product: { create: vi.fn(), update: vi.fn() },
    productInventory: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    productReceipt: { create: vi.fn() },
    auditLog: { create: vi.fn() },
};
const prismaMock = {
    $transaction: vi.fn(),
    productInventory: { findMany: vi.fn() },
};
const requireGasStationAccessMock = vi.fn();
const requireGasProductsEnabledMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
    requireGasProductsEnabled: requireGasProductsEnabledMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    txMock.station.findUnique.mockResolvedValue({ id: 'station-5', hasProducts: true });
    requireGasStationAccessMock.mockResolvedValue({
        station: { dbId: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์' },
        user: { id: 'staff-5', role: 'STAFF' },
    });
    requireGasProductsEnabledMock.mockReturnValue(null);
});

describe('S131 product inventory write service', () => {
    it('creates product, opening receipt and audit in one bounded SERIALIZABLE transaction', async () => {
        txMock.station.findUnique.mockResolvedValue({ id: 'station-5', hasProducts: true });
        txMock.product.create.mockResolvedValue({ id: 'product-1' });
        txMock.productInventory.create.mockResolvedValue({
            id: 'inventory-1', productId: 'product-1', quantity: 5, alertLevel: 2,
            product: { id: 'product-1', salePrice: 20, costPrice: 10 },
        });

        const { createStationProduct } = await import('../src/services/product-inventory-write-service');
        const result = await createStationProduct({
            stationId: 'station-5', userId: 'staff-5', name: 'น้ำ', unit: 'ขวด',
            salePrice: 20, costPrice: 10, quantity: 5, alertLevel: 2,
        });

        expect(result.success).toBe(true);
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
            maxWait: 5000,
            timeout: 20000,
            isolationLevel: 'Serializable',
        }));
        expect(txMock.productReceipt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            stationId: 'station-5', productId: 'product-1', quantity: 5, costPrice: 10,
        }) });
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            userId: 'staff-5', action: 'CREATE', model: 'ProductInventory', recordId: 'inventory-1',
        }) });
    });

    it('fails closed instead of silently creating/upserting a missing station', async () => {
        txMock.station.findUnique.mockResolvedValue(null);
        const {
            createStationProduct,
            receiveStationProduct,
            updateStationProduct,
        } = await import('../src/services/product-inventory-write-service');
        const createResult = await createStationProduct({
            stationId: 'station-5', userId: 'staff-5', name: 'น้ำ', unit: 'ขวด',
            salePrice: 20, costPrice: null, quantity: 0, alertLevel: null,
        });
        const updateResult = await updateStationProduct({
            stationId: 'station-5', userId: 'staff-5', productId: 'product-1', salePrice: 20, alertLevel: null,
        });
        const receiveResult = await receiveStationProduct({
            stationId: 'station-5', userId: 'staff-5', productId: 'product-1', quantity: 1,
        });
        expect(createResult).toMatchObject({ success: false, status: 404 });
        expect(updateResult).toMatchObject({ success: false, status: 404 });
        expect(receiveResult).toMatchObject({ success: false, status: 404 });
        expect(txMock.product.create).not.toHaveBeenCalled();
        expect(txMock.productInventory.create).not.toHaveBeenCalled();
        expect(txMock.productInventory.findUnique).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('updates price, alert level and audit atomically', async () => {
        txMock.productInventory.findUnique.mockResolvedValue({
            id: 'inventory-1', productId: 'product-1', quantity: 9, alertLevel: 2,
            product: { salePrice: 20 },
        });
        txMock.product.update.mockResolvedValue({ id: 'product-1' });
        txMock.productInventory.update.mockResolvedValue({ id: 'inventory-1' });

        const { updateStationProduct } = await import('../src/services/product-inventory-write-service');
        const result = await updateStationProduct({
            stationId: 'station-5', userId: 'staff-5', productId: 'product-1', salePrice: 25, alertLevel: 3,
        });

        expect(result.success).toBe(true);
        expect(txMock.product.update).toHaveBeenCalledWith({ where: { id: 'product-1' }, data: { salePrice: 25 } });
        expect(txMock.productInventory.update).toHaveBeenCalledWith({ where: { id: 'inventory-1' }, data: { alertLevel: 3 } });
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            action: 'UPDATE', model: 'ProductInventory', recordId: 'inventory-1',
            oldData: expect.objectContaining({ salePrice: 20, alertLevel: 2 }),
            newData: expect.objectContaining({ salePrice: 25, alertLevel: 3 }),
        }) });
    });

    it('receives stock, receipt and audit atomically with an increment operation', async () => {
        txMock.productInventory.findUnique.mockResolvedValue({ id: 'inventory-1', productId: 'product-1', quantity: 9 });
        txMock.productInventory.update.mockResolvedValue({ quantity: 13 });

        const { receiveStationProduct } = await import('../src/services/product-inventory-write-service');
        const result = await receiveStationProduct({
            stationId: 'station-5', userId: 'staff-5', productId: 'product-1', quantity: 4,
        });

        expect(result).toEqual({ success: true, value: { newQuantity: 13 } });
        expect(txMock.productInventory.update).toHaveBeenCalledWith({
            where: { id: 'inventory-1' }, data: { quantity: { increment: 4 } }, select: { quantity: true },
        });
        expect(txMock.productReceipt.create).toHaveBeenCalledWith({ data: {
            productId: 'product-1', stationId: 'station-5', quantity: 4,
        } });
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            userId: 'staff-5', action: 'UPDATE', model: 'ProductInventory', recordId: 'inventory-1',
        }) });
    });

    it('rejects fractional/negative quantities and non-positive prices before a write', async () => {
        const {
            parseNonNegativeInventoryInteger,
            parsePositiveInventoryInteger,
            parsePositivePrice,
        } = await import('../src/services/product-inventory-write-service');

        expect(parseNonNegativeInventoryInteger(1.5, 'จำนวน')).toHaveProperty('error');
        expect(parseNonNegativeInventoryInteger(-1, 'จำนวน')).toHaveProperty('error');
        expect(parsePositiveInventoryInteger(0, 'จำนวน')).toHaveProperty('error');
        expect(parsePositiveInventoryInteger(true, 'จำนวน')).toHaveProperty('error');
        expect(parsePositivePrice(0)).toHaveProperty('error');
        expect(parsePositivePrice(true)).toHaveProperty('error');
        expect(parsePositivePrice(Number.POSITIVE_INFINITY)).toHaveProperty('error');
    });
});

describe('S131 product API retirement boundaries', () => {
    it('retires dead sell/add_to_inventory actions without starting a write transaction', async () => {
        const { POST } = await import('../src/app/api/gas-station/[id]/products/route');
        for (const action of ['sell', 'add_to_inventory']) {
            const response = await POST(new Request('http://localhost/api/gas-station/5/products', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action }),
            }), { params: Promise.resolve({ id: '5' }) });
            expect(response.status).toBe(410);
        }
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('retires dedicated add and sell endpoints after station/product capability auth', async () => {
        const { POST: add } = await import('../src/app/api/gas-station/[id]/products/add/route');
        const addResponse = await add(new Request('http://localhost/api/gas-station/5/products/add', { method: 'POST' }) as never, {
            params: Promise.resolve({ id: '5' }),
        });
        expect(addResponse.status).toBe(410);

        const { POST: sell } = await import('../src/app/api/gas-station/[id]/products/sell/route');
        const sellResponse = await sell(new Request('http://localhost/api/gas-station/5/products/sell', { method: 'POST' }) as never, {
            params: Promise.resolve({ id: '5' }),
        });
        expect(sellResponse.status).toBe(410);
        expect(requireGasStationAccessMock).toHaveBeenCalledTimes(2);
        expect(requireGasProductsEnabledMock).toHaveBeenCalledTimes(2);
    });

    it('rejects malformed create/receive input before starting a transaction', async () => {
        const { POST } = await import('../src/app/api/gas-station/[id]/products/route');
        const badCreate = await POST(new Request('http://localhost/api/gas-station/5/products', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'create', name: 'น้ำ', unit: 'ขวด', salePrice: 20, quantity: 1.5 }),
        }), { params: Promise.resolve({ id: '5' }) });
        expect(badCreate.status).toBe(400);

        const badReceive = await POST(new Request('http://localhost/api/gas-station/5/products', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'receive', productId: 'product-1', quantity: -1 }),
        }), { params: Promise.resolve({ id: '5' }) });
        expect(badReceive.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
});
