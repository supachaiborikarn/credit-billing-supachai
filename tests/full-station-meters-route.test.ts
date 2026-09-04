import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    meterReading: {
        upsert: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    dailyRecord: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
    },
    shift: {
        findFirst: vi.fn(),
    },
    meterReading: {
        findMany: vi.fn(),
    },
};

const requireStationAccessApiMock = vi.fn();
const ensureOpenShiftMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({
    requireStationAccessApi: requireStationAccessApiMock,
}));
vi.mock('@/lib/full-station-shift-sync', () => ({
    ensureOpenFullStationShiftForDailyRecord: ensureOpenShiftMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
    prismaMock.$transaction.mockImplementation(async (
        callback: (client: typeof txMock) => unknown
    ) => callback(txMock));
    prismaMock.dailyRecord.findUnique.mockResolvedValue({ id: 'daily-1', status: 'CLOSED' });
    prismaMock.dailyRecord.upsert.mockResolvedValue({ id: 'daily-1', status: 'OPEN' });
    prismaMock.shift.findFirst.mockResolvedValue({
        id: 'shift-2',
        dailyRecordId: 'daily-1',
        status: 'OPEN',
    });
    const existingMeters = [1, 2, 3, 4].map(nozzleNumber => ({
        id: `meter-${nozzleNumber}`,
        shiftId: 'shift-2',
        nozzleNumber,
        startReading: 1_000 + nozzleNumber,
        endReading: 0,
        soldQty: null,
        startPhoto: `start-${nozzleNumber}.webp`,
        endPhoto: `end-${nozzleNumber}.webp`,
    }));
    prismaMock.meterReading.findMany.mockResolvedValue(existingMeters);
    txMock.meterReading.upsert.mockImplementation(async ({ where, update }: {
        where: { shiftId_nozzleNumber: { nozzleNumber: number } };
        update: Record<string, unknown>;
    }) => ({
        ...existingMeters[where.shiftId_nozzleNumber.nozzleNumber - 1],
        ...update,
    }));
    txMock.auditLog.create.mockResolvedValue({});
});

describe('full-station meter write route', () => {
    it('keeps current-day STAFF meter entry and open-shift fallback working', async () => {
        requireStationAccessApiMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
        ensureOpenShiftMock.mockResolvedValue({ id: 'shift-live', dailyRecordId: 'daily-1', status: 'OPEN' });
        const { getTodayBangkok } = await import('../src/lib/date-utils');
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: getTodayBangkok(), type: 'start',
                    meters: [1, 2, 3, 4].map(nozzleNumber => ({ nozzleNumber, reading: 2000 + nozzleNumber, photo: `live-start-${nozzleNumber}` })),
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        expect(response.status).toBe(200);
        expect(prismaMock.dailyRecord.upsert).toHaveBeenCalledTimes(1);
        expect(prismaMock.dailyRecord.findUnique).not.toHaveBeenCalled();
        expect(ensureOpenShiftMock).toHaveBeenCalledTimes(1);
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects STAFF historical opening-meter correction', async () => {
        requireStationAccessApiMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
        prismaMock.dailyRecord.findUnique.mockResolvedValue({ id: 'daily-1', status: 'OPEN' });
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: '2026-07-10', shiftId: 'shift-2', type: 'start', meters: [{ nozzleNumber: 1, reading: 1501, photo: 'start-1' }] }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        expect(response.status).toBe(403);
        expect(prismaMock.dailyRecord.findUnique).toHaveBeenCalledTimes(1);
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
    });

    it('allows STAFF to finish end meters on an exact historical OPEN Tank Loy shift', async () => {
        requireStationAccessApiMock.mockResolvedValue({ user: { id: 'staff-1', role: 'STAFF', stationId: 'station-1' } });
        prismaMock.dailyRecord.findUnique.mockResolvedValue({ id: 'daily-1', status: 'OPEN' });
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '2026-07-10', shiftId: 'shift-2', type: 'end',
                    meters: [1, 2, 3, 4].map(nozzleNumber => ({
                        nozzleNumber,
                        reading: 1_500 + nozzleNumber,
                        photo: `end-${nozzleNumber}.webp`,
                    })),
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(200);
        expect(txMock.meterReading.upsert).toHaveBeenCalledTimes(4);
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('does not create a missing historical DailyRecord', async () => {
        prismaMock.dailyRecord.findUnique.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: '2026-07-10', shiftId: 'shift-2', type: 'end', meters: [{ nozzleNumber: 1, reading: 1501, photo: 'end-1' }] }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        expect(response.status).toBe(404);
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
    });

    it('requires an existing shift id for historical correction', async () => {
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: '2026-07-10', type: 'start', meters: [{ nozzleNumber: 1, reading: 1001, photo: 'start-1' }] }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        expect(response.status).toBe(400);
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
    });

    it('updates the exact shift returned by daily data and recalculates sold liters', async () => {
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '2026-07-10',
                    shiftId: 'shift-2',
                    type: 'end',
                    meters: [1, 2, 3, 4].map(nozzleNumber => ({
                        nozzleNumber,
                        reading: 1_500 + nozzleNumber,
                        photo: `end-${nozzleNumber}.webp`,
                    })),
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            shiftId: 'shift-2',
        });
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
        expect(txMock.meterReading.upsert).toHaveBeenCalledTimes(4);
        expect(txMock.meterReading.upsert).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: {
                    shiftId_nozzleNumber: {
                        shiftId: 'shift-2',
                        nozzleNumber: 1,
                    },
                },
                update: expect.objectContaining({
                    endReading: 1_501,
                    soldQty: 500,
                }),
            })
        );
        expect(txMock.auditLog.create).toHaveBeenCalledTimes(4);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a stale shift id instead of writing another shift silently', async () => {
        prismaMock.shift.findFirst.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '2026-07-10',
                    shiftId: 'stale-shift',
                    type: 'end',
                    meters: [{ nozzleNumber: 1, reading: 1_501, photo: 'end-1.webp' }],
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(409);
        expect(txMock.meterReading.upsert).not.toHaveBeenCalled();
    });

    it('keeps soldQty empty when a split-shift closing row has no start baseline', async () => {
        prismaMock.meterReading.findMany.mockResolvedValue([
            {
                id: 'meter-split-1',
                shiftId: 'shift-2',
                nozzleNumber: 1,
                startReading: 0,
                endReading: 0,
                soldQty: null,
                startPhoto: 'start-1.webp',
                endPhoto: 'end-1.webp',
            },
        ]);
        txMock.meterReading.upsert.mockResolvedValue({ id: 'meter-split-1' });

        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '2026-06-28',
                    shiftId: 'shift-2',
                    type: 'end',
                    meters: [{ nozzleNumber: 1, reading: 5_000, photo: 'end-1.webp' }],
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(200);
        expect(txMock.meterReading.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ soldQty: null }),
        }));
    });

    it('rejects a closing reading below its start instead of hiding it as zero sales', async () => {
        const { POST } = await import('../src/app/api/station/[id]/meters/route');
        const response = await POST(
            new Request('http://localhost/api/station/1/meters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: '2026-07-10',
                    shiftId: 'shift-2',
                    type: 'end',
                    meters: [{ nozzleNumber: 1, reading: 500, photo: 'end-1.webp' }],
                }),
            }) as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: expect.stringContaining('เลขสิ้นสุดน้อยกว่าเลขเริ่มต้น'),
        });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
});
