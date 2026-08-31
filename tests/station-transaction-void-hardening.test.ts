import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionFindUniqueMock = vi.fn();
const transactionUpdateManyMock = vi.fn();
const auditLogCreateMock = vi.fn();
const txMock = {
    transaction: { updateMany: transactionUpdateManyMock },
    auditLog: { create: auditLogCreateMock },
};
const prismaMock = {
    transaction: { findUnique: transactionFindUniqueMock },
    $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
};
const requireApiSessionMock = vi.fn();
const canAccessStationMock = vi.fn();
const canMutateHistoricalStationDataMock = vi.fn();
const isStationRouteBoundToTransactionMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireApiSession: requireApiSessionMock }));
vi.mock('@/lib/auth-utils', () => ({ canAccessStation: canAccessStationMock }));
vi.mock('@/lib/stations/station-context', () => ({
    canMutateHistoricalStationData: canMutateHistoricalStationDataMock,
    isStationRouteBoundToTransaction: isStationRouteBoundToTransactionMock,
}));

const oldTransaction = {
    id: 'txn-1',
    stationId: 'station-5',
    licensePlate: 'กข 1234',
    ownerName: 'ลูกค้าทดสอบ',
    amount: 500,
    isVoided: false,
    deletedAt: null,
    dailyRecord: { shifts: [] },
};

function deleteRequest(reason?: unknown) {
    const init: RequestInit = { method: 'DELETE' };
    if (arguments.length > 0) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({ reason });
    }
    return new Request('http://localhost/api/station/station-5/transactions/txn-1', init);
}

beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue({
        response: null,
        user: { id: 'admin-1', role: 'ADMIN', stationId: null },
    });
    canAccessStationMock.mockReturnValue(true);
    canMutateHistoricalStationDataMock.mockReturnValue(true);
    isStationRouteBoundToTransactionMock.mockReturnValue(true);
    transactionFindUniqueMock.mockResolvedValue(oldTransaction);
    transactionUpdateManyMock.mockResolvedValue({ count: 1 });
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

describe('station transaction void hardening', () => {
    it('keeps authentication before reason validation', async () => {
        requireApiSessionMock.mockResolvedValueOnce({
            response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        });
        const { DELETE } = await import('../src/app/api/station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(deleteRequest() as never, {
            params: Promise.resolve({ id: 'station-5', transactionId: 'txn-1' }),
        });

        expect(response.status).toBe(401);
        expect(transactionFindUniqueMock).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', undefined, false],
        ['blank', '   ', true],
        ['too short', 'ab', true],
        ['too long', 'ก'.repeat(201), true],
    ])('rejects a %s reason before reading or writing the transaction', async (_label, reason, includeBody) => {
        const { DELETE } = await import('../src/app/api/station/[id]/transactions/[transactionId]/route');
        const request = includeBody ? deleteRequest(reason) : deleteRequest();
        const response = await DELETE(request as never, {
            params: Promise.resolve({ id: 'station-5', transactionId: 'txn-1' }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'เหตุผลในการยกเลิกต้องมีความยาว 3-200 ตัวอักษร',
        });
        expect(transactionFindUniqueMock).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('stores the trimmed reason on the voided row and AuditLog in one transaction', async () => {
        const { DELETE } = await import('../src/app/api/station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(deleteRequest('  ลงรายการซ้ำ  ') as never, {
            params: Promise.resolve({ id: 'station-5', transactionId: 'txn-1' }),
        });

        expect(response.status).toBe(200);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(transactionUpdateManyMock).toHaveBeenCalledWith({
            where: { id: 'txn-1', isVoided: false, deletedAt: null },
            data: expect.objectContaining({
                isVoided: true,
                voidedById: 'admin-1',
                voidReason: 'ลงรายการซ้ำ',
            }),
        });
        expect(auditLogCreateMock).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin-1',
                action: 'DELETE',
                model: 'Transaction',
                recordId: 'txn-1',
                newData: {
                    isVoided: true,
                    voidReason: 'ลงรายการซ้ำ',
                },
            }),
        });
    });

    it('preserves the first void metadata when the transaction is already voided', async () => {
        transactionFindUniqueMock.mockResolvedValueOnce({
            ...oldTransaction,
            isVoided: true,
            deletedAt: new Date('2026-08-31T01:00:00.000Z'),
            voidReason: 'เหตุผลเดิม',
            voidedById: 'admin-original',
        });
        const { DELETE } = await import('../src/app/api/station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(deleteRequest('เหตุผลใหม่') as never, {
            params: Promise.resolve({ id: 'station-5', transactionId: 'txn-1' }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: 'รายการนี้ถูกยกเลิกไปแล้ว' });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(transactionUpdateManyMock).not.toHaveBeenCalled();
        expect(auditLogCreateMock).not.toHaveBeenCalled();
    });

    it('does not create a second AuditLog when another request wins the void race', async () => {
        transactionUpdateManyMock.mockResolvedValueOnce({ count: 0 });
        const { DELETE } = await import('../src/app/api/station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(deleteRequest('คำขอซ้ำ') as never, {
            params: Promise.resolve({ id: 'station-5', transactionId: 'txn-1' }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: 'รายการนี้ถูกยกเลิกไปแล้ว' });
        expect(transactionUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'txn-1', isVoided: false, deletedAt: null },
        }));
        expect(auditLogCreateMock).not.toHaveBeenCalled();
    });
});
