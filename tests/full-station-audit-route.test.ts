import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    dailyRecord: { findUnique: vi.fn() },
    transaction: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
};
const requireStationAccessApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));

beforeEach(() => {
    vi.clearAllMocks();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', stationId: null },
    });
    const closedAt = new Date('2026-08-20T12:00:00.000Z');
    prismaMock.dailyRecord.findUnique.mockResolvedValue({
        id: 'daily-1',
        shifts: [{ id: 'shift-1', closedAt }],
        meters: [{ id: 'meter-1', shift: { closedAt } }],
    });
    prismaMock.transaction.findMany.mockResolvedValue([
        { id: 'tx-1', shift: { closedAt }, dailyRecord: { shifts: [{ closedAt }] } },
    ]);
    prismaMock.auditLog.findMany.mockResolvedValue([
        {
            id: 'audit-1',
            userId: 'admin-1',
            action: 'UPDATE',
            model: 'Transaction',
            recordId: 'tx-1',
            oldData: { amount: 100, paymentType: 'CASH' },
            newData: { amount: 120, paymentType: 'TRANSFER', reason: 'แก้ยอดจากหลักฐาน' },
            createdAt: new Date('2026-08-20T13:00:00.000Z'),
            user: { name: 'ผู้ดูแล' },
        },
        {
            id: 'audit-2',
            userId: 'admin-1',
            action: 'CLOSE',
            model: 'Shift',
            recordId: 'shift-1',
            oldData: null,
            newData: { status: 'CLOSED' },
            createdAt: new Date('2026-08-20T12:00:01.000Z'),
            user: { name: 'ผู้ดูแล' },
        },
    ]);
});

describe('FULL station audit route', () => {
    it('blocks non-admin users before reading audit data', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' },
        });
        const { GET } = await import('../src/app/api/station/[id]/audit/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/audit?date=2026-08-20') as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(403);
        expect(prismaMock.dailyRecord.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid business date', async () => {
        const { GET } = await import('../src/app/api/station/[id]/audit/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/audit?date=20-08-2026') as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(400);
        expect(prismaMock.dailyRecord.findUnique).not.toHaveBeenCalled();
    });

    it('returns real station-bound logs and marks edits made after close', async () => {
        const { GET } = await import('../src/app/api/station/[id]/audit/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/audit?date=2026-08-20') as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                recordId: {
                    in: expect.arrayContaining(['daily-1', 'shift-1', 'meter-1', 'tx-1']),
                },
            },
        }));
        expect(body.logs).toHaveLength(2);
        expect(body.logs[0]).toMatchObject({
            id: 'audit-1',
            action: 'UPDATE',
            entityType: 'TRANSACTION',
            entityId: 'tx-1',
            userName: 'ผู้ดูแล',
            isPostClose: true,
            reason: 'แก้ยอดจากหลักฐาน',
        });
        expect(body.logs[0].changes).toEqual(expect.arrayContaining([
            { field: 'amount', oldValue: '100', newValue: '120' },
            { field: 'paymentType', oldValue: 'CASH', newValue: 'TRANSFER' },
        ]));
        expect(body.logs[1]).toMatchObject({
            action: 'CLOSE',
            entityType: 'SHIFT',
            isPostClose: false,
        });
    });

    it('returns an empty list without querying AuditLog when the date has no records', async () => {
        prismaMock.dailyRecord.findUnique.mockResolvedValue(null);
        prismaMock.transaction.findMany.mockResolvedValue([]);
        const { GET } = await import('../src/app/api/station/[id]/audit/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/audit?date=2026-08-20') as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ logs: [] });
        expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });
});
