import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTodayBangkok } from '@/lib/date-utils';

const prismaMock = {
    station: { findUnique: vi.fn() },
    dailyRecord: { findUnique: vi.fn(), upsert: vi.fn() },
    shift: { findFirst: vi.fn() },
    owner: { findFirst: vi.fn() },
    transaction: { findFirst: vi.fn(), create: vi.fn() },
    truck: { findFirst: vi.fn(), create: vi.fn() },
    productInventory: { updateMany: vi.fn() },
};
const requireStationAccessApiMock = vi.fn();
const ensureOpenShiftMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));
vi.mock('@/lib/full-station-shift-sync', () => ({
    ensureOpenFullStationShiftForDailyRecord: ensureOpenShiftMock,
}));
vi.mock('@/lib/station-bill-number', () => ({
    suggestNextStationBill: vi.fn(),
}));

function request(date: string) {
    return new Request('http://localhost/api/station/1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date,
            paymentType: 'CASH',
            nozzleNumber: 1,
            liters: 10,
            pricePerLiter: 31.34,
            amount: 313.4,
        }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    requireStationAccessApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    prismaMock.station.findUnique.mockResolvedValue({ type: 'FULL' });
    prismaMock.dailyRecord.findUnique.mockResolvedValue({ id: 'daily-old', status: 'OPEN' });
    prismaMock.dailyRecord.upsert.mockResolvedValue({ id: 'daily-today', status: 'OPEN' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 'shift-old', dailyRecordId: 'daily-old', status: 'OPEN' });
    ensureOpenShiftMock.mockResolvedValue({ id: 'shift-today', dailyRecordId: 'daily-today', status: 'OPEN' });
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue({ id: 'txn-created' });
});

describe('FULL station transaction create route', () => {
    it('blocks STAFF historical creation before any database mutation', async () => {
        requireStationAccessApiMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
        const { POST } = await import('../src/app/api/station/[id]/transactions/route');
        const response = await POST(request('2026-08-20') as never, { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(403);
        expect(prismaMock.station.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.dailyRecord.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
        expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    });

    it('does not upsert a missing historical DailyRecord', async () => {
        prismaMock.dailyRecord.findUnique.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/station/[id]/transactions/route');
        const response = await POST(request('2026-08-20') as never, { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(404);
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
        expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    });

    it('does not create a new shift for historical transaction correction', async () => {
        prismaMock.shift.findFirst.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/station/[id]/transactions/route');
        const response = await POST(request('2026-08-20') as never, { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(400);
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
        expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    });

    it('allows ADMIN historical creation only against an existing OPEN shift', async () => {
        const { POST } = await import('../src/app/api/station/[id]/transactions/route');
        const response = await POST(request('2026-08-20') as never, { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(200);
        expect(prismaMock.dailyRecord.findUnique).toHaveBeenCalledTimes(1);
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ dailyRecordId: 'daily-old', shiftId: 'shift-old', amount: 313.4 }),
        }));
    });

    it('keeps current-day STAFF creation on the existing upsert/open-shift path', async () => {
        requireStationAccessApiMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
        const { POST } = await import('../src/app/api/station/[id]/transactions/route');
        const response = await POST(request(getTodayBangkok()) as never, { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(200);
        expect(prismaMock.dailyRecord.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.dailyRecord.upsert).toHaveBeenCalledTimes(1);
        expect(ensureOpenShiftMock).toHaveBeenCalledTimes(1);
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ dailyRecordId: 'daily-today', shiftId: 'shift-today' }),
        }));
    });
});
