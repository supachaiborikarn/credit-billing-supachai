import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    owner: { update: vi.fn(), delete: vi.fn() },
    truck: { updateMany: vi.fn() },
    transaction: { updateMany: vi.fn() },
    invoice: { updateMany: vi.fn() },
    billingCollection: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
};

const prismaMock = {
    owner: { findUnique: vi.fn() },
    truck: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
};

const requireAdminApiMock = vi.fn();
const requireApiSessionMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
    requireApiSession: requireApiSessionMock,
}));

function resetTree(tree: Record<string, unknown>) {
    for (const value of Object.values(tree)) {
        if (typeof value === 'function' && 'mockReset' in value) {
            (value as ReturnType<typeof vi.fn>).mockReset();
        } else if (value && typeof value === 'object') {
            resetTree(value as Record<string, unknown>);
        }
    }
}

beforeEach(() => {
    resetTree(txMock);
    resetTree(prismaMock);
    requireAdminApiMock.mockReset();
    requireApiSessionMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    requireApiSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
});

describe('customer master-data admin routes', () => {
    it('merges every direct Owner relation atomically and audits the target', async () => {
        prismaMock.owner.findUnique
            .mockResolvedValueOnce({
                id: 'source', name: 'Source', currentCredit: 125, lineUserId: 'LINE-SOURCE',
                _count: { trucks: 2, transactions: 3, invoices: 1, billingCollections: 1 },
            })
            .mockResolvedValueOnce({
                id: 'target', name: 'Target', currentCredit: 200, lineUserId: null,
                _count: { trucks: 1, transactions: 4, invoices: 2, billingCollections: 2 },
            });
        txMock.truck.updateMany.mockResolvedValue({ count: 2 });
        txMock.transaction.updateMany.mockResolvedValue({ count: 3 });
        txMock.invoice.updateMany.mockResolvedValue({ count: 1 });
        txMock.billingCollection.updateMany.mockResolvedValue({ count: 1 });
        txMock.owner.update.mockResolvedValue({});
        txMock.owner.delete.mockResolvedValue({});
        txMock.auditLog.create.mockResolvedValue({});

        const { POST } = await import('../src/app/api/admin/owners/merge/route');
        const response = await POST(new Request('http://localhost/api/admin/owners/merge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceOwnerId: 'source', targetOwnerId: 'target' }),
        }) as never);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true, trucksMoved: 2, transactionsMoved: 3, invoicesMoved: 1,
            billingCollectionsMoved: 1, lineTransferred: true,
        });
        expect(txMock.truck.updateMany).toHaveBeenCalledWith({ where: { ownerId: 'source' }, data: { ownerId: 'target' } });
        expect(txMock.transaction.updateMany).toHaveBeenCalledWith({
            where: { ownerId: 'source' }, data: { ownerId: 'target', ownerName: 'Target' },
        });
        expect(txMock.invoice.updateMany).toHaveBeenCalledWith({ where: { ownerId: 'source' }, data: { ownerId: 'target' } });
        expect(txMock.billingCollection.updateMany).toHaveBeenCalledWith({ where: { ownerId: 'source' }, data: { ownerId: 'target' } });
        expect(txMock.owner.update).toHaveBeenCalledWith({ where: { id: 'source' }, data: { lineUserId: null } });
        expect(txMock.owner.update).toHaveBeenCalledWith({ where: { id: 'target' }, data: { lineUserId: 'LINE-SOURCE' } });
        expect(txMock.owner.update).toHaveBeenCalledWith({ where: { id: 'target' }, data: { currentCredit: { increment: 125 } } });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'admin-1', action: 'MERGE', model: 'Owner', recordId: 'target' }),
        }));
        expect(txMock.owner.delete).toHaveBeenCalledWith({ where: { id: 'source' } });
        expect(prismaMock.$transaction.mock.calls[0]?.[1]).toEqual({ maxWait: 5_000, timeout: 20_000 });
    });

    it('refuses merge when both owners already have different LINE mappings', async () => {
        prismaMock.owner.findUnique
            .mockResolvedValueOnce({ id: 'source', name: 'Source', currentCredit: 0, lineUserId: 'LINE-A', _count: {} })
            .mockResolvedValueOnce({ id: 'target', name: 'Target', currentCredit: 0, lineUserId: 'LINE-B', _count: {} });
        const { POST } = await import('../src/app/api/admin/owners/merge/route');
        const response = await POST(new Request('http://localhost/api/admin/owners/merge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceOwnerId: 'source', targetOwnerId: 'target' }),
        }) as never);
        expect(response.status).toBe(409);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('blocks non-admin truck edits before touching master data', async () => {
        requireAdminApiMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { PUT } = await import('../src/app/api/trucks/[id]/route');
        const response = await PUT(new Request('http://localhost/api/trucks/truck-1', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licensePlate: 'กก-1234', ownerId: 'target' }),
        }) as never, { params: Promise.resolve({ id: 'truck-1' }) });
        expect(response.status).toBe(403);
        expect(prismaMock.owner.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.truck.update).not.toHaveBeenCalled();
    });

    it('lets an admin reassign and rename a truck', async () => {
        prismaMock.owner.findUnique.mockResolvedValue({ id: 'target' });
        prismaMock.truck.findFirst.mockResolvedValue(null);
        prismaMock.truck.update.mockResolvedValue({ id: 'truck-1', licensePlate: 'ABC-123', ownerId: 'target' });
        const { PUT } = await import('../src/app/api/trucks/[id]/route');
        const response = await PUT(new Request('http://localhost/api/trucks/truck-1', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licensePlate: 'abc-123', ownerId: 'target' }),
        }) as never, { params: Promise.resolve({ id: 'truck-1' }) });
        expect(response.status).toBe(200);
        expect(prismaMock.truck.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'truck-1' }, data: { ownerId: 'target', licensePlate: 'ABC-123' },
        }));
    });
});
