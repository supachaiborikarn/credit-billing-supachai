import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    requireAdminApi: vi.fn(),
    findMany: vi.fn(),
    txFindUnique: vi.fn(),
    txUpdateMany: vi.fn(),
    txAuditCreate: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: mocks.requireAdminApi }));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        meterAnomaly: { findMany: mocks.findMany },
        $transaction: mocks.transaction,
    },
}));

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdminApi.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.findMany.mockResolvedValue([]);
    mocks.txFindUnique.mockResolvedValue({ reviewedAt: null, reviewedById: null });
    mocks.txUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txAuditCreate.mockResolvedValue({ id: 'audit-1' });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
        meterAnomaly: { findUnique: mocks.txFindUnique, updateMany: mocks.txUpdateMany },
        auditLog: { create: mocks.txAuditCreate },
    }));
});

describe('meter anomaly admin hardening', () => {
    it('blocks pending anomalies before DB access for non-admin', async () => {
        mocks.requireAdminApi.mockResolvedValue({ response: new Response(null, { status: 403 }) });
        const { GET } = await import('../src/app/api/admin/anomalies/route');
        const response = await GET();
        expect(response.status).toBe(403);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it('loads shift/station relation required by the anomaly review UI', async () => {
        const { getPendingAnomalies } = await import('../src/services/anomaly-detection');
        await getPendingAnomalies();
        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            include: {
                shift: {
                    select: {
                        shiftNumber: true,
                        dailyRecord: { select: { date: true, station: { select: { name: true } } } },
                    },
                },
            },
        }));
    });

    it('blocks review before transaction for non-admin', async () => {
        mocks.requireAdminApi.mockResolvedValue({ response: new Response(null, { status: 403 }) });
        const { POST } = await import('../src/app/api/admin/anomalies/[id]/review/route');
        const response = await POST(new NextRequest('http://localhost', { method: 'POST' }), {
            params: Promise.resolve({ id: 'anomaly-1' }),
        });
        expect(response.status).toBe(403);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('reviews once and audits atomically', async () => {
        const { POST } = await import('../src/app/api/admin/anomalies/[id]/review/route');
        const response = await POST(new NextRequest('http://localhost', { method: 'POST' }), {
            params: Promise.resolve({ id: 'anomaly-1' }),
        });
        expect(response.status).toBe(200);
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
        expect(mocks.txUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'anomaly-1', reviewedAt: null },
            data: expect.objectContaining({ reviewedById: 'admin-1' }),
        }));
        expect(mocks.txAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'REVIEW', model: 'MeterAnomaly', recordId: 'anomaly-1' }),
        }));
    });

    it('returns conflict when anomaly was already reviewed', async () => {
        mocks.txFindUnique.mockResolvedValue({ reviewedAt: new Date(), reviewedById: 'admin-old' });
        const { POST } = await import('../src/app/api/admin/anomalies/[id]/review/route');
        const response = await POST(new NextRequest('http://localhost', { method: 'POST' }), {
            params: Promise.resolve({ id: 'anomaly-1' }),
        });
        expect(response.status).toBe(409);
        expect(mocks.txAuditCreate).not.toHaveBeenCalled();
    });
});
