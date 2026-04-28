import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    shift: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    dailyRecord: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    meterReading: {
        create: vi.fn(),
        upsert: vi.fn(),
    },
    gaugeReading: {
        create: vi.fn(),
        deleteMany: vi.fn(),
    },
    gasSettings: {
        findUnique: vi.fn(),
    },
    station: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    transaction: {
        updateMany: vi.fn(),
        create: vi.fn(),
    },
    shiftReconciliation: {
        upsert: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    transaction: {
        create: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
    },
    dailyRecord: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    shift: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    shiftReconciliation: {
        upsert: vi.fn(),
    },
    meterReading: {
        update: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
    },
    gaugeReading: {
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
    },
    gasSettings: {
        findUnique: vi.fn(),
    },
    station: {
        findUnique: vi.fn(),
    },
    owner: {
        findFirst: vi.fn(),
    },
    truck: {
        findFirst: vi.fn(),
    },
};

const requireGasStationAccessMock = vi.fn();
const resolveGasStationMock = vi.fn();
const requireStationAccessApiMock = vi.fn();
const requireAdminApiMock = vi.fn();

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
    requireAdminApi: requireAdminApiMock,
}));

function buildJsonRequest(body: unknown, method = 'POST'): Request {
    return new Request('http://localhost/api/test', {
        method,
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
    requireAdminApiMock.mockReset();

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

    requireAdminApiMock.mockResolvedValue({
        user: { id: 'admin-1' },
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
        expect(txMock.shift.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: 'OPEN',
                dailyRecord: expect.objectContaining({
                    stationId: 'station-5',
                    date: new Date('2026-04-22T17:00:00.000Z'),
                }),
            }),
        }));
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

    it('uses the submitted daily gas price when opening a shift', async () => {
        txMock.shift.findFirst.mockResolvedValue(null);
        txMock.dailyRecord.findFirst.mockResolvedValue(null);
        txMock.dailyRecord.create.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-22T17:00:00.000Z'),
            gasPrice: 18.75,
        });
        txMock.station.findUnique.mockResolvedValue({ gasPrice: 16.09 });
        txMock.station.update.mockResolvedValue({});
        txMock.auditLog.create.mockResolvedValue({});
        txMock.shift.create.mockResolvedValue({ id: 'shift-1' });
        txMock.meterReading.create.mockResolvedValue({});
        txMock.gaugeReading.create.mockResolvedValue({});

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/open/route');
        const response = await POST(buildJsonRequest({
            dateKey: '2026-04-23',
            shiftNumber: 1,
            gasPrice: 18.75,
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
            gasPrice: 18.75,
            stationGasPrice: 18.75,
        });
        expect(txMock.station.findUnique).toHaveBeenCalledWith({
            where: { id: 'station-5' },
            select: { gasPrice: true },
        });
        expect(txMock.station.update).toHaveBeenCalledWith({
            where: { id: 'station-5' },
            data: { gasPrice: 18.75 },
        });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                model: 'Station',
                recordId: 'station-5',
                newData: expect.objectContaining({
                    gasPrice: 18.75,
                    source: 'gas-shift-open-price-update',
                }),
            }),
        }));
        expect(txMock.gasSettings.findUnique).not.toHaveBeenCalled();
        expect(txMock.dailyRecord.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                gasPrice: 18.75,
                retailPrice: 18.75,
                wholesalePrice: 18.75,
            }),
        }));
    });

    it('does not let stale open shifts from previous days block a new gas shift', async () => {
        txMock.shift.findFirst.mockResolvedValue(null);
        txMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-24T17:00:00.000Z'),
            gasPrice: 16.09,
        });
        txMock.shift.create.mockResolvedValue({ id: 'shift-today' });
        txMock.meterReading.create.mockResolvedValue({});
        txMock.gaugeReading.create.mockResolvedValue({});

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/open/route');
        const response = await POST(buildJsonRequest({
            dateKey: '2026-04-25',
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
            shiftId: 'shift-today',
        });
        expect(txMock.shift.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: 'OPEN',
                dailyRecord: expect.objectContaining({
                    stationId: 'station-5',
                    date: new Date('2026-04-24T17:00:00.000Z'),
                }),
            }),
        }));
    });

    it('rejects opening the same gas shift number twice for the same day', async () => {
        txMock.shift.findFirst.mockResolvedValue(null);
        txMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-24T17:00:00.000Z'),
            gasPrice: 16.09,
        });
        txMock.shift.findUnique.mockResolvedValue({
            id: 'shift-existing',
            shiftNumber: 1,
        });

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/open/route');
        const response = await POST(buildJsonRequest({
            dateKey: '2026-04-25',
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

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            error: expect.stringContaining('กะเช้า'),
        });
        expect(txMock.shift.create).not.toHaveBeenCalled();
        expect(txMock.meterReading.create).not.toHaveBeenCalled();
        expect(txMock.gaugeReading.create).not.toHaveBeenCalled();
    });

    it('lets station staff update the daily gas price after opening a shift', async () => {
        txMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-22T17:00:00.000Z'),
            gasPrice: 16.09,
            retailPrice: 16.09,
            wholesalePrice: 16.09,
        });
        txMock.dailyRecord.update.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-22T17:00:00.000Z'),
            gasPrice: 18.25,
        });
        txMock.station.findUnique.mockResolvedValue({ id: 'station-5', gasPrice: 16.09 });
        txMock.station.update.mockResolvedValue({});
        txMock.auditLog.create.mockResolvedValue({});

        const { PUT } = await import('../src/app/api/v2/gas/[stationId]/price/route');
        const response = await PUT(buildJsonRequest({
            gasPrice: 18.25,
        }, 'PUT') as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            dailyRecordId: 'daily-1',
            gasPrice: 18.25,
            stationGasPrice: 18.25,
        });
        expect(txMock.dailyRecord.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'daily-1' },
            data: {
                gasPrice: 18.25,
                retailPrice: 18.25,
                wholesalePrice: 18.25,
            },
        }));
        expect(txMock.station.update).toHaveBeenCalledWith({
            where: { id: 'station-5' },
            data: { gasPrice: 18.25 },
        });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'UPDATE',
                model: 'DailyRecord',
                recordId: 'daily-1',
                newData: expect.objectContaining({
                    gasPrice: 18.25,
                    source: 'gas-staff-price-update',
                    persistsAsStationDefault: true,
                }),
            }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: 'user-1',
                action: 'UPDATE',
                model: 'Station',
                recordId: 'station-5',
                newData: expect.objectContaining({
                    gasPrice: 18.25,
                    source: 'gas-staff-price-update',
                }),
            }),
        }));
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

    it('records gas sales by deriving liters from the submitted amount and daily gas price', async () => {
        prismaMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            gasPrice: 18.5,
            shifts: [{ id: 'shift-1' }],
        });
        prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/sell/route');
        const response = await POST(buildJsonRequest({
            paymentType: 'CASH',
            liters: 999,
            pricePerLiter: 1,
            amount: 185,
            notes: 'client should not control price or liters',
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

    it('rejects credit sales without complete bill details', async () => {
        const { POST } = await import('../src/app/api/v2/gas/[stationId]/sell/route');
        const response = await POST(buildJsonRequest({
            paymentType: 'CREDIT',
            amount: 185,
            ownerId: 'owner-1',
            truckId: 'truck-1',
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: 'ต้องกรอกเล่มที่และเลขที่บิลเงินเชื่อ',
        });
        expect(prismaMock.dailyRecord.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    });

    it('records credit sales with owner, truck, and bill links verified server-side', async () => {
        prismaMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            gasPrice: 18.5,
            shifts: [{ id: 'shift-1' }],
        });
        prismaMock.owner.findFirst.mockResolvedValue({ id: 'owner-1' });
        prismaMock.truck.findFirst.mockResolvedValue({ licensePlate: 'บย 1026' });
        prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/sell/route');
        const response = await POST(buildJsonRequest({
            paymentType: 'CREDIT',
            amount: 185,
            ownerId: 'owner-1',
            truckId: 'truck-1',
            licensePlate: 'client-supplied-plate',
            bookNo: ' A1 ',
            billNo: ' 1001 ',
            notes: ' credit test ',
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(200);
        expect(prismaMock.owner.findFirst).toHaveBeenCalledWith({
            where: { id: 'owner-1', deletedAt: null },
            select: { id: true },
        });
        expect(prismaMock.truck.findFirst).toHaveBeenCalledWith({
            where: { id: 'truck-1', ownerId: 'owner-1', deletedAt: null },
            select: { licensePlate: true },
        });
        expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                paymentType: 'CREDIT',
                ownerId: 'owner-1',
                truckId: 'truck-1',
                licensePlate: 'บย 1026',
                billBookNo: 'A1',
                billNo: '1001',
                notes: 'credit test',
                liters: 10,
                amount: 185,
            }),
        }));
    });

    it('persists admin gas data-entry sales as linked summary transactions', async () => {
        txMock.station.findFirst.mockResolvedValue({ id: 'station-5', gasPrice: 16 });
        txMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-24T17:00:00.000Z'),
            gasPrice: 16,
            retailPrice: 16,
        });
        txMock.dailyRecord.update.mockResolvedValue({
            id: 'daily-1',
            date: new Date('2026-04-24T17:00:00.000Z'),
            gasPrice: 16,
            retailPrice: 16,
        });
        txMock.shift.findFirst.mockResolvedValue(null);
        txMock.shift.create.mockResolvedValue({ id: 'shift-1' });
        txMock.shift.update.mockResolvedValue({ id: 'shift-1' });
        txMock.meterReading.upsert.mockResolvedValue({});
        txMock.gaugeReading.deleteMany.mockResolvedValue({ count: 0 });
        txMock.gaugeReading.create.mockResolvedValue({});
        txMock.transaction.updateMany.mockResolvedValue({ count: 0 });
        txMock.transaction.create.mockResolvedValue({ id: 'tx-summary' });
        txMock.shiftReconciliation.upsert.mockResolvedValue({});
        txMock.auditLog.create.mockResolvedValue({});

        const { POST } = await import('../src/app/api/v2/gas/admin/data-entry/route');
        const response = await POST(buildJsonRequest({
            stationId: 'station-5',
            date: '2026-04-25',
            shiftNumber: 1,
            status: 'CLOSED',
            gasPrice: 16,
            meters: [
                { nozzle: 1, start: 100, end: 110 },
                { nozzle: 2, start: 200, end: 200 },
                { nozzle: 3, start: 300, end: 300 },
                { nozzle: 4, start: 400, end: 400 },
            ],
            gauges: [
                { tank: 1, start: 40, end: 39 },
                { tank: 2, start: 50, end: 49 },
                { tank: 3, start: 60, end: 59 },
            ],
            sales: {
                cash: 160,
                credit: 80,
                card: 0,
                transfer: 32,
                nonGasSales: 10,
                expenses: 5,
            },
        }) as never);

        expect(response.status).toBe(200);
        expect(txMock.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: 'shift-1',
                notes: { startsWith: 'admin-data-entry:' },
            }),
        }));
        expect(txMock.transaction.create).toHaveBeenCalledTimes(3);
        expect(txMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: 'shift-1',
                paymentType: 'CASH',
                amount: 160,
                liters: 10,
                recordedById: 'admin-1',
                notes: 'admin-data-entry:cash',
            }),
        }));
        expect(txMock.shiftReconciliation.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                expectedFuelAmount: 160,
                expectedOtherAmount: 5,
                totalExpected: 165,
                cashReceived: 160,
                creditReceived: 80,
                transferReceived: 32,
                totalReceived: 272,
                variance: 107,
                varianceStatus: 'YELLOW',
            }),
        }));
    });

    it('rejects negative received amounts when closing a gas shift', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
            dailyRecordId: 'daily-1',
            shiftNumber: 1,
            dailyRecord: { stationId: 'station-5', gasPrice: 18.5 },
            meters: [
                { nozzleNumber: 1, startReading: 1000, endReading: 1010, soldQty: null },
                { nozzleNumber: 2, startReading: 2000, endReading: 2010, soldQty: null },
                { nozzleNumber: 3, startReading: 3000, endReading: 3010, soldQty: null },
                { nozzleNumber: 4, startReading: 4000, endReading: 4010, soldQty: null },
            ],
        });
        prismaMock.gaugeReading.count.mockResolvedValue(3);

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/close/route');
        const response = await POST(buildJsonRequest({
            shiftId: 'shift-1',
            reconciliation: {
                cashReceived: -1,
                creditReceived: 0,
                cardReceived: 0,
                transferReceived: 0,
            },
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: 'ยอดรับจริง ยอดขายอื่น และค่าใช้จ่ายต้องเป็นจำนวนไม่ติดลบ',
        });
        expect(prismaMock.shiftReconciliation.upsert).not.toHaveBeenCalled();
        expect(prismaMock.shift.update).not.toHaveBeenCalled();
    });

    it('stores non-gas sales and other expenses when closing a gas shift', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-1',
            status: 'OPEN',
            dailyRecordId: 'daily-1',
            shiftNumber: 1,
            dailyRecord: { stationId: 'station-5', gasPrice: 18.5 },
            meters: [
                { nozzleNumber: 1, startReading: 1000, endReading: 1010, soldQty: null },
                { nozzleNumber: 2, startReading: 2000, endReading: 2010, soldQty: null },
                { nozzleNumber: 3, startReading: 3000, endReading: 3010, soldQty: null },
                { nozzleNumber: 4, startReading: 4000, endReading: 4010, soldQty: null },
            ],
        });
        prismaMock.gaugeReading.count.mockResolvedValue(3);
        prismaMock.shiftReconciliation.upsert.mockResolvedValue({});
        prismaMock.shift.update.mockResolvedValue({});

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/shift/close/route');
        const response = await POST(buildJsonRequest({
            shiftId: 'shift-1',
            reconciliation: {
                cashReceived: 800,
                creditReceived: 20,
                cardReceived: 30,
                transferReceived: 40,
                nonGasSalesAmount: 100,
                otherExpensesAmount: 25,
                varianceNote: 'ตรวจยอดแล้ว',
            },
        }) as never, {
            params: Promise.resolve({ stationId: 'station-5' }),
        });

        expect(response.status).toBe(200);
        expect(prismaMock.shiftReconciliation.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                expectedFuelAmount: 740,
                expectedOtherAmount: 75,
                totalExpected: 815,
                transferReceived: 70,
                totalReceived: 890,
                variance: 75,
            }),
        }));
        expect(prismaMock.shift.update).toHaveBeenCalledWith({
            where: { id: 'shift-1' },
            data: expect.objectContaining({
                status: 'CLOSED',
                closedById: 'user-1',
                varianceNote: 'ตรวจยอดแล้ว | cardReceived=30.00 | nonGasSalesAmount=100.00 | otherExpensesAmount=25.00',
            }),
        });
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            summary: {
                expectedFuel: 740,
                expectedOther: 75,
                nonGasSalesAmount: 100,
                otherExpensesAmount: 25,
                expected: 815,
                received: 890,
                variance: 75,
            },
        });
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
