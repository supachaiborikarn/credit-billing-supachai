import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    productInventory: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    productInventory: {
        findMany: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
});

describe('S107 inventory adjustment service', () => {
    it('updates an existing inventory atomically and writes an ADJUST AuditLog', async () => {
        txMock.productInventory.findUnique.mockResolvedValue({
            id: 'inventory-1',
            stationId: 'station-5',
            productId: 'product-1',
            quantity: 4,
            product: { name: 'น้ำดื่ม' },
        });
        txMock.productInventory.update.mockResolvedValue({ id: 'inventory-1', quantity: 7 });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

        const { adjustInventory } = await import('../src/services/inventory-service');
        const result = await adjustInventory('station-5', 'product-1', 3, 'admin-1', 'นับสต็อกจริง');

        expect(result).toMatchObject({ success: true, inventoryId: 'inventory-1', previousQuantity: 4, newQuantity: 7 });
        expect(txMock.productInventory.update).toHaveBeenCalledWith({ where: { id: 'inventory-1' }, data: { quantity: 7 } });
        expect(txMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin-1',
                action: 'ADJUST',
                model: 'ProductInventory',
                recordId: 'inventory-1',
                oldData: expect.objectContaining({ quantity: 4 }),
                newData: expect.objectContaining({ quantity: 7, quantityChange: 3, reason: 'นับสต็อกจริง' }),
            }),
        });
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
            isolationLevel: 'Serializable',
            maxWait: 5000,
            timeout: 20000,
        }));
    });

    it('does not silently create inventory when the station/product row is missing', async () => {
        txMock.productInventory.findUnique.mockResolvedValue(null);
        const { adjustInventory } = await import('../src/services/inventory-service');
        const result = await adjustInventory('station-5', 'missing-product', 2, 'admin-1', 'ตรวจนับ');
        expect(result).toMatchObject({ success: false, code: 'NOT_FOUND' });
        expect(txMock.productInventory.update).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects an adjustment that would make stock negative without mutating data', async () => {
        txMock.productInventory.findUnique.mockResolvedValue({
            id: 'inventory-1', stationId: 'station-5', productId: 'product-1', quantity: 2, product: { name: 'น้ำดื่ม' },
        });
        const { adjustInventory } = await import('../src/services/inventory-service');
        const result = await adjustInventory('station-5', 'product-1', -3, 'admin-1', 'ยอดเสียหาย');
        expect(result).toMatchObject({ success: false, code: 'INSUFFICIENT_STOCK', newQuantity: 2 });
        expect(txMock.productInventory.update).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('includes zero-stock items in low-stock results and preserves alertLevel zero', async () => {
        prismaMock.productInventory.findMany.mockResolvedValue([
            { quantity: 0, alertLevel: 2, product: { id: 'p-zero', name: 'หมดแล้ว' } },
            { quantity: 0, alertLevel: 0, product: { id: 'p-zero-alert', name: 'เตือนศูนย์' } },
            { quantity: 5, alertLevel: 2, product: { id: 'p-ok', name: 'ปกติ' } },
        ]);
        const { checkLowStock } = await import('../src/services/inventory-service');
        const result = await checkLowStock('station-5');
        expect(prismaMock.productInventory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { stationId: 'station-5' } }));
        expect(result.map((row) => row.productId)).toEqual(['p-zero', 'p-zero-alert']);
        expect(result.find((row) => row.productId === 'p-zero-alert')?.alertLevel).toBe(0);
    });
});
