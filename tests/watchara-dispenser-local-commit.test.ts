import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    station: { findUnique: vi.fn() },
    externalSalesSource: { upsert: vi.fn(), update: vi.fn() },
    externalDispenserTransaction: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
};
const prismaMock = {
    station: { findUnique: vi.fn() },
    externalSalesSource: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    externalDispenserTransaction: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
};
const fetchRowsMock = vi.fn();
const fetchLatestMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/watchara-dispenser-client', () => ({
    fetchWatcharaDispenserTransactions: fetchRowsMock,
    fetchWatcharaDispenserLatestTransactionAt: fetchLatestMock,
}));

const source = {
    id: 'source-1', code: 'watchara_shared_dispenser', name: 'Watchara shared dispenser', stationId: 'station-2',
    sourceStationRef: 'station-1', fuelFamily: 'DIESEL', rollupMode: 'all_day_single_shift', isEnabled: true,
    lastSyncAttemptAt: null, lastSyncedAt: null, lastSeenSourceAt: null, lastError: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('WATCHARA_DISPENSER_DATABASE_URL', 'postgresql://external');
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    prismaMock.station.findUnique.mockResolvedValue({ id: 'station-2', name: 'Watchara' });
    prismaMock.externalSalesSource.upsert.mockResolvedValue(source);
    prismaMock.externalSalesSource.update.mockResolvedValue(source);
    prismaMock.externalDispenserTransaction.findMany.mockResolvedValue([]);
    txMock.station.findUnique.mockResolvedValue({ id: 'station-2', name: 'Watchara' });
    txMock.externalSalesSource.upsert.mockResolvedValue(source);
    txMock.externalSalesSource.update.mockResolvedValue(source);
    txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    txMock.externalDispenserTransaction.upsert.mockResolvedValue({ id: 'landing-1' });
    fetchLatestMock.mockResolvedValue(new Date('2026-08-30T10:00:00.000Z'));
    fetchRowsMock.mockResolvedValue([]);
});

describe('S123 Watchara local commit boundary', () => {
    it('bootstraps source registry and audit atomically', async () => {
        const { bootstrapWatcharaSalesSource } = await import('../src/lib/watchara-dispenser-sync');
        const result = await bootstrapWatcharaSalesSource('admin-1');
        expect(result).toMatchObject({ id: 'source-1' });
        expect(txMock.externalSalesSource.upsert).toHaveBeenCalled();
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            userId: 'admin-1', action: 'WATCHARA_DISPENSER_BOOTSTRAP', model: 'ExternalSalesSource', recordId: 'watchara_shared_dispenser',
        }) });
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
    });

    it('commits landing rows, source sync status and sync AuditLog in one bounded transaction', async () => {
        fetchRowsMock.mockResolvedValueOnce([{
            externalTxId: 'ext-1', externalStationRef: 'station-1', externalDailyRecordRef: 'daily-1',
            soldAt: new Date('2026-08-30T03:00:00.000Z'), businessDate: '2026-08-30', nozzleNumber: 1,
            productLabel: 'Diesel', liters: 10, amountBaht: 300, pricePerLiter: 30, paymentType: 'CASH', billNo: 'B1',
            recordedByRef: 'u1', rawJson: { id: 'ext-1' }, sourceUpdatedAt: new Date('2026-08-30T03:05:00.000Z'),
            isVoided: false, isDeleted: false,
        }]);
        const { syncWatcharaDispenser } = await import('../src/lib/watchara-dispenser-sync');
        const result = await syncWatcharaDispenser({ startDate: '2026-08-30', endDate: '2026-08-30', triggeredByUserId: 'admin-1' });
        expect(result).toMatchObject({ rowsFetched: 1, created: 1, updated: 0, dryRun: false });
        expect(txMock.externalDispenserTransaction.upsert).toHaveBeenCalledTimes(1);
        expect(txMock.externalSalesSource.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'source-1' } }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            userId: 'admin-1', action: 'WATCHARA_DISPENSER_SYNC', model: 'ExternalSalesSource', recordId: 'watchara_shared_dispenser',
        }) });
        expect(prismaMock.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { maxWait: 5000, timeout: 30000 });
    });

    it('does not write landing rows during dry-run but still records the operator audit', async () => {
        prismaMock.externalSalesSource.findUnique.mockResolvedValueOnce({ id: 'source-1', lastSeenSourceAt: null });
        const { syncWatcharaDispenser } = await import('../src/lib/watchara-dispenser-sync');
        const result = await syncWatcharaDispenser({ startDate: '2026-08-30', endDate: '2026-08-30', dryRun: true, triggeredByUserId: 'admin-1' });
        expect(result.dryRun).toBe(true);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(txMock.externalDispenserTransaction.upsert).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'WATCHARA_DISPENSER_DRY_RUN' }) });
    });
});
