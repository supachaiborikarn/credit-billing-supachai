import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    shift: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    dailyRecord: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    meterReading: {
        create: vi.fn(),
    },
    gaugeReading: {
        create: vi.fn(),
    },
    gasSettings: {
        findUnique: vi.fn(),
    },
    station: {
        findUnique: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    transaction: {
        create: vi.fn(),
        count: vi.fn(),
    },
    dailyRecord: {
        findFirst: vi.fn(),
    },
    shift: {
        findUnique: vi.fn(),
    },
    meterReading: {
        update: vi.fn(),
        create: vi.fn(),
    },
    gaugeReading: {
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    gasSettings: {
        findUnique: vi.fn(),
    },
    station: {
        findUnique: vi.fn(),
    },
};

const requireGasStationAccessMock = vi.fn();
const resolveGasStationMock = vi.fn();
const requireStationAccessApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
    shiftBelongsToStation: (shift: { dailyRecord?: { stationId: string } | null } | null, station: { dbId: string }) =>
        Boolean(shift?.dailyRecord?.stationId === station.dbId),
}));

vi.mock('@/lib/gas/station-resolver', () => ({
    resolveGasStation: resolveGasStationMock,
    getNonGasStationError: () => ({ error: 'not gas station' }),
}));

vi.mock('@/lib/api-auth', () => ({
    requireStationAccessApi: requireStationAccessApiMock,
}));

function buildJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function resetMockTree(tree: Record<string, unknown>) {
    for (const value of Object.values(tree)) {
        if (typeof value === 'function' && 'mockReset' in value) {
            (value as ReturnType<typeof vi.fn>).mockReset();
            continue;
        }

        if (value && typeof value === 'object') {
            resetMockTree(value as Record<string, unknown>);
        }
    }
}

beforeEach(() => {
    resetMockTree(txMock);
    resetMockTree(prismaMock);
    requireGasStationAccessMock.mockReset();
    resolveGasStationMock.mockReset();
    requireStationAccessApiMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof txMock) => unknown) => callback(txMock));

    requireGasStationAccessMock.mockResolvedValue({
        station: {
            id: 'station-5',
            dbId: 'station-5',
            name: 'ปั๊มแก๊สพงษ์อนันต์',
            type: 'GAS',
            index: 5,
        },
        user: { id: 'user-1' },
    });

    resolveGasStationMock.mockResolvedValue({
        id: 'station-5',
        dbId: 'station-5',
        name: 'ปั๊มแก๊สพงษ์อนันต์',
        type: 'GAS',
        index: 5,
    });

    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'user-1' },
    });
});

describe('gas v2 route guards', () => {
    it('opens a shift inside a transaction and seeds the day gas price from configured defaults', async () => {
        txMock.shift.findFirst.mockResolvedValue(null);
        txMock.dailyRecord.findFirst.mockResolvedValue(null);
        txMock.station.findUnique.mockResolvedValue({ gasPrice: null });
        txMock.gasSettings.findUnique.mockResolvedValue({ value: '17.25' });
        txMock.dailyRecord.create.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-22T17:00:00.000Z'),
            gasPrice: 17.25,
        });
        txMock.shift.create.mockResolvedValue({ id: 'shift-1' });
        txMock.meterReading.create.mockResolvedValue({});
        txMock.gaugeReading.create.mockResolvedValue({});

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/open/route');
        const response = await POST(buildJsonRequest({
            dateKey: '2026-04-23',
            shiftNumber: 1,
            meters: [
                { nozzleNumber: 1, reading: 1000 },
                { nozzleNumber: 2, reading: 1001 },
                { nozzleNumber: 3, reading: 1002 },
                { nozzleNumber: 4, reading: 1003 },
            ],
            gauges: [
                { tankNumber: 1, percentage: 40 },
                { tankNumber: 2, percentage: 50 },
                { tankNumber: 3, percentage: 60 },
            ],
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            shiftId: 'shift-1',
            gasPrice: 17.25,
        });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(txMock.dailyRecord.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                gasPrice: 17.25,
                retailPrice: 17.25,
                wholesalePrice: 17.25,
            }),
        }));
        expect(txMock.meterReading.create).toHaveBeenCalledTimes(4);
        expect(txMock.gaugeReading.create).toHaveBeenCalledTimes(3);
    });

    it('rejects invalid shift-open payloads before any database transaction starts', async () => {
        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/open/route');
        const response = await POST(buildJsonRequest({
            dateKey: '2026-04-23',
            shiftNumber: 1,
            meters: [
                { nozzleNumber: 1, reading: 1000 },
                { nozzleNumber: 1, reading: 1001 },
                { nozzleNumber: 3, reading: 1002 },
                { nozzleNumber: 4, reading: 1003 },
            ],
            gauges: [
                { tankNumber: 1, percentage: 40 },
                { tankNumber: 2, percentage: 50 },
                { tankNumber: 3, percentage: 60 },
            ],
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('records gas sales with the daily gas price from the server instead of trusting client totals', async () => {
        prismaMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            gasPrice: 18.5,
            shifts: [{ id: 'shift-1' }],
        });
        prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/sell/route');
        const response = await POST(buildJsonRequest({
            paymentType: 'CASH',
            liters: 10,
            pricePerLiter: 1,
            amount: 1,
            notes: 'client should not control totals',
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(200);
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                liters: 10,
                pricePerLiter: 18.5,
                amount: 185,
            }),
        }));
    });

    it('blocks start-meter edits once the shift already has sales', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
            dailyRecordId: 'daily-1',
            shiftNumber: 1,
            dailyRecord: { stationId: 'station-5' },
            meters: [
                { id: 'm1', nozzleNumber: 1, startReading: 1000, endReading: null },
                { id: 'm2', nozzleNumber: 2, startReading: 1001, endReading: null },
                { id: 'm3', nozzleNumber: 3, startReading: 1002, endReading: null },
                { id: 'm4', nozzleNumber: 4, startReading: 1003, endReading: null },
            ],
            reconciliation: null,
        });
        prismaMock.transaction.count.mockResolvedValue(2);
        prismaMock.gaugeReading.count.mockResolvedValue(0);

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/meters/route');
        const response = await POST(buildJsonRequest({
            shiftId: 'shift-1',
            type: 'start',
            readings: [
                { nozzleNumber: 1, reading: 1000 },
                { nozzleNumber: 2, reading: 1001 },
                { nozzleNumber: 3, reading: 1002 },
                { nozzleNumber: 4, reading: 1003 },
            ],
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            error: 'กะนี้เริ่มมีรายการขายแล้ว',
        });
        expect(prismaMock.meterReading.update).not.toHaveBeenCalled();
        expect(prismaMock.meterReading.create).not.toHaveBeenCalled();
    });

    it('blocks start-gauge edits once the shift already has close data', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
            dailyRecordId: 'daily-1',
            shiftNumber: 1,
            dailyRecord: { stationId: 'station-5' },
            meters: [{ endReading: 1500 }],
            reconciliation: null,
        });
        prismaMock.transaction.count.mockResolvedValue(0);
        prismaMock.gaugeReading.count.mockResolvedValue(0);

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/gauge/route');
        const response = await POST(buildJsonRequest({
            shiftId: 'shift-1',
            type: 'start',
            readings: [
                { tankNumber: 1, percentage: 40 },
                { tankNumber: 2, percentage: 50 },
                { tankNumber: 3, percentage: 60 },
            ],
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            error: 'มีข้อมูลปิดกะแล้ว',
        });
        expect(prismaMock.gaugeReading.update).not.toHaveBeenCalled();
        expect(prismaMock.gaugeReading.create).not.toHaveBeenCalled();
    });
});
