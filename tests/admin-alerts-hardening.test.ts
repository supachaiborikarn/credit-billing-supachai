import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    requireAdminApi: vi.fn(),
    reconciliationFindMany: vi.fn(),
    shiftFindMany: vi.fn(),
    auditFindMany: vi.fn(),
    txShiftFindUnique: vi.fn(),
    txShiftUpdateMany: vi.fn(),
    txAuditCreate: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: mocks.requireAdminApi }));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        shiftReconciliation: { findMany: mocks.reconciliationFindMany },
        shift: { findMany: mocks.shiftFindMany },
        auditLog: { findMany: mocks.auditFindMany },
        $transaction: mocks.transaction,
    },
}));

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdminApi.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.reconciliationFindMany.mockResolvedValue([]);
    mocks.shiftFindMany.mockResolvedValue([]);
    mocks.auditFindMany.mockResolvedValue([]);
    mocks.txShiftFindUnique.mockResolvedValue({ status: 'CLOSED', lockedAt: null, lockedById: null });
    mocks.txShiftUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txAuditCreate.mockResolvedValue({ id: 'audit-1' });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
        shift: { findUnique: mocks.txShiftFindUnique, updateMany: mocks.txShiftUpdateMany },
        auditLog: { create: mocks.txAuditCreate },
    }));
});

describe('admin alerts hardening', () => {
    it('blocks GET before any alert query when caller is not ADMIN', async () => {
        mocks.requireAdminApi.mockResolvedValue({ response: new Response(null, { status: 403 }) });
        const { GET } = await import('../src/app/api/admin/alerts/route');
        const response = await GET(new NextRequest('http://localhost/api/admin/alerts?days=7'));
        expect(response.status).toBe(403);
        expect(mocks.reconciliationFindMany).not.toHaveBeenCalled();
    });

    it.each(['0', '91', '7x', '-1'])('rejects invalid days=%s before queries', async (days) => {
        const { GET } = await import('../src/app/api/admin/alerts/route');
        const response = await GET(new NextRequest(`http://localhost/api/admin/alerts?days=${days}`));
        expect(response.status).toBe(400);
        expect(mocks.reconciliationFindMany).not.toHaveBeenCalled();
    });

    it('blocks POST before transaction when caller is not ADMIN', async () => {
        mocks.requireAdminApi.mockResolvedValue({ response: new Response(null, { status: 403 }) });
        const { POST } = await import('../src/app/api/admin/alerts/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/alerts', {
            method: 'POST', body: JSON.stringify({ action: 'lock', shiftId: 'shift-1' }),
        }));
        expect(response.status).toBe(403);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('rejects locking a non-CLOSED shift without audit', async () => {
        mocks.txShiftFindUnique.mockResolvedValue({ status: 'OPEN', lockedAt: null, lockedById: null });
        const { POST } = await import('../src/app/api/admin/alerts/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/alerts', {
            method: 'POST', body: JSON.stringify({ action: 'lock', shiftId: 'shift-1' }),
        }));
        expect(response.status).toBe(409);
        expect(mocks.txShiftUpdateMany).not.toHaveBeenCalled();
        expect(mocks.txAuditCreate).not.toHaveBeenCalled();
    });

    it('locks CLOSED shift and creates audit in the same bounded transaction', async () => {
        const { POST } = await import('../src/app/api/admin/alerts/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/alerts', {
            method: 'POST', body: JSON.stringify({ action: 'lock', shiftId: 'shift-1' }),
        }));
        expect(response.status).toBe(200);
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
        expect(mocks.txShiftUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'shift-1', status: 'CLOSED' },
            data: expect.objectContaining({ status: 'LOCKED', lockedById: 'admin-1' }),
        }));
        expect(mocks.txAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'LOCK', model: 'Shift', recordId: 'shift-1', userId: 'admin-1' }),
        }));
    });
});
