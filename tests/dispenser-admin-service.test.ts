import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    fuelProduct: { findMany: vi.fn(), findFirst: vi.fn() },
    dispenser: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    nozzle: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
};
const prismaMock = {
    $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
});

describe('S122 dispenser admin service', () => {
    it('rejects retired stations before opening a write transaction', async () => {
        const { createDispenserAdmin } = await import('../src/services/dispenser-admin-service');
        const result = await createDispenserAdmin({ stationId: 'station-2', code: 'D1', nozzles: [], userId: 'admin-1' });
        expect(result).toMatchObject({ success: false, code: 'INVALID_STATION' });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('normalizes an active station alias and creates dispenser plus AuditLog atomically', async () => {
        txMock.dispenser.create.mockResolvedValue({ id: 'disp-1', stationId: 'station-5', code: 'D1', nozzles: [] });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        const { createDispenserAdmin } = await import('../src/services/dispenser-admin-service');
        const result = await createDispenserAdmin({
            stationId: 'd01b9c7b-fcf0-4185-a0b1-a5840391a61c', code: 'D1', nozzles: [], userId: 'admin-1',
        });
        expect(result.success).toBe(true);
        expect(txMock.dispenser.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stationId: 'station-5', code: 'D1' }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            userId: 'admin-1', action: 'CREATE', model: 'Dispenser', recordId: 'disp-1',
            newData: expect.objectContaining({ stationId: 'station-5', code: 'D1' }),
        }) });
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
    });

    it('rejects inactive or missing FuelProduct before creating a nozzle', async () => {
        txMock.dispenser.findFirst.mockResolvedValue({ id: 'disp-1' });
        txMock.fuelProduct.findFirst.mockResolvedValue(null);
        const { createNozzleAdmin } = await import('../src/services/dispenser-admin-service');
        const result = await createNozzleAdmin({
            stationId: 'station-1', dispenserId: 'disp-1', code: 'N1', productId: 'missing-product', userId: 'admin-1',
        });
        expect(result).toMatchObject({ success: false, code: 'INVALID_PRODUCT' });
        expect(txMock.nozzle.create).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('updates a nozzle and records normalized old/new state in the same transaction', async () => {
        txMock.nozzle.findFirst.mockResolvedValue({ id: 'nozzle-1', code: 'N1', productId: 'fuel-old', isActive: true });
        txMock.fuelProduct.findFirst.mockResolvedValue({ id: 'fuel-new' });
        txMock.nozzle.update.mockResolvedValue({ id: 'nozzle-1', code: 'N2', productId: 'fuel-new', isActive: false });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        const { updateNozzleAdmin } = await import('../src/services/dispenser-admin-service');
        const result = await updateNozzleAdmin({
            stationId: 'station-5', dispenserId: 'disp-1', nozzleId: 'nozzle-1', code: 'N2', productId: 'fuel-new', isActive: false, userId: 'admin-1',
        });
        expect(result.success).toBe(true);
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            action: 'UPDATE', model: 'Nozzle', recordId: 'nozzle-1',
            oldData: expect.objectContaining({ stationId: 'station-5', code: 'N1', productId: 'fuel-old', isActive: true }),
            newData: expect.objectContaining({ stationId: 'station-5', code: 'N2', productId: 'fuel-new', isActive: false }),
        }) });
    });

    it('soft-deletes a dispenser and its active nozzles with one DELETE audit', async () => {
        txMock.dispenser.findFirst.mockResolvedValue({
            id: 'disp-1', code: 'D1', isActive: true,
            nozzles: [{ id: 'nozzle-1', code: 'N1', productId: 'fuel-1' }],
        });
        txMock.nozzle.updateMany.mockResolvedValue({ count: 1 });
        txMock.dispenser.update.mockResolvedValue({ id: 'disp-1' });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        const { deleteDispenserAdmin } = await import('../src/services/dispenser-admin-service');
        const result = await deleteDispenserAdmin({ stationId: 'station-1', dispenserId: 'disp-1', userId: 'admin-1' });
        expect(result.success).toBe(true);
        expect(txMock.nozzle.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { dispenserId: 'disp-1', deletedAt: null } }));
        expect(txMock.dispenser.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'disp-1' } }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'DELETE', model: 'Dispenser', recordId: 'disp-1' }) });
    });
});
