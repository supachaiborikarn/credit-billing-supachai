import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    shift: {
        findUnique: vi.fn(),
    },
    meterReading: {
        update: vi.fn(),
    },
    shiftReconciliation: {
        update: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    shift: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },
};

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

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

function buildShift() {
    return {
        id: 'shift-2',
        dailyRecordId: 'daily-1',
        shiftNumber: 2,
        status: 'CLOSED',
        dailyRecord: {
            id: 'daily-1',
            stationId: 'station-5',
            date: new Date('2026-07-14T17:00:00.000Z'),
            gasPrice: 16.49,
            station: {
                id: 'station-5',
                name: 'ปั๊มแก๊สพงษ์อนันต์',
                type: 'GAS',
                gasPrice: 16.49,
            },
        },
        meters: [
            { id: 'meter-1', nozzleNumber: 1, startReading: 90, endReading: 110, soldQty: 20 },
            { id: 'meter-2', nozzleNumber: 2, startReading: 190, endReading: 210, soldQty: 20 },
            { id: 'meter-3', nozzleNumber: 3, startReading: 290, endReading: 310, soldQty: 20 },
            { id: 'meter-4', nozzleNumber: 4, startReading: 390, endReading: 410, soldQty: 20 },
        ],
        reconciliation: {
            id: 'recon-1',
            expectedFuelAmount: 1319.2,
            expectedOtherAmount: 10,
            totalExpected: 1329.2,
            totalReceived: 700,
            variance: -629.2,
            varianceStatus: 'RED',
        },
    };
}

function buildRequest(readings: number[]) {
    return new Request('http://localhost/api/test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            readings: readings.map((reading, index) => ({
                nozzleNumber: index + 1,
                reading,
            })),
            reason: 'พนักงานกรอกเลขเปิดกะผิด',
        }),
    });
}

beforeEach(() => {
    resetMockTree(txMock);
    resetMockTree(prismaMock);
    requireAdminApiMock.mockReset();

    prismaMock.$transaction.mockImplementation(
        async (callback: (client: typeof txMock) => unknown) => callback(txMock)
    );
    requireAdminApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
    txMock.meterReading.update.mockResolvedValue({});
    txMock.shiftReconciliation.update.mockResolvedValue({});
    txMock.auditLog.create.mockResolvedValue({});
});

describe('gas admin meter edit route', () => {
    it('loads current opening meters with the previous shift closing values', async () => {
        prismaMock.shift.findUnique.mockResolvedValue(buildShift());
        prismaMock.shift.findFirst.mockResolvedValue({
            id: 'shift-1',
            shiftNumber: 1,
            createdAt: new Date('2026-07-14T00:00:00.000Z'),
            dailyRecord: { date: new Date('2026-07-14T17:00:00.000Z') },
            meters: [
                { nozzleNumber: 1, endReading: 100 },
                { nozzleNumber: 2, endReading: 200 },
                { nozzleNumber: 3, endReading: 300 },
                { nozzleNumber: 4, endReading: 400 },
            ],
        });

        const { GET } = await import('../src/app/api/v2/gas/admin/meters/[shiftId]/route');
        const response = await GET(new Request('http://localhost/api/test') as never, {
            params: Promise.resolve({ shiftId: 'shift-2' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            shift: {
                id: 'shift-2',
                stationId: 'station-5',
                shiftNumber: 2,
                hasReconciliation: true,
            },
            previousShift: {
                id: 'shift-1',
                shiftNumber: 1,
            },
            meters: [
                { nozzleNumber: 1, startReading: 90, previousEndReading: 100 },
                { nozzleNumber: 2, startReading: 190, previousEndReading: 200 },
                { nozzleNumber: 3, startReading: 290, previousEndReading: 300 },
                { nozzleNumber: 4, startReading: 390, previousEndReading: 400 },
            ],
        });
    });

    it('updates opening meters and recalculates a closed shift reconciliation', async () => {
        txMock.shift.findUnique.mockResolvedValue(buildShift());

        const { PUT } = await import('../src/app/api/v2/gas/admin/meters/[shiftId]/route');
        const response = await PUT(buildRequest([100, 200, 300, 400]) as never, {
            params: Promise.resolve({ shiftId: 'shift-2' }),
        });

        expect(response.status).toBe(200);
        expect(txMock.meterReading.update).toHaveBeenCalledTimes(4);
        expect(txMock.meterReading.update).toHaveBeenNthCalledWith(1, {
            where: { id: 'meter-1' },
            data: { startReading: 100, soldQty: 10 },
        });
        expect(txMock.shiftReconciliation.update).toHaveBeenCalledWith({
            where: { shiftId: 'shift-2' },
            data: {
                expectedFuelAmount: 659.6,
                totalExpected: 669.6,
                variance: 30.4,
                varianceStatus: 'GREEN',
            },
        });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: 'UPDATE_OPENING_METERS',
                model: 'Shift',
                recordId: 'shift-2',
                newData: expect.objectContaining({
                    reason: 'พนักงานกรอกเลขเปิดกะผิด',
                    source: 'gas-admin-meter-edit',
                }),
            }),
        }));
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            changedCount: 4,
            reconciliation: {
                expectedFuelAmount: 659.6,
                totalExpected: 669.6,
                variance: 30.4,
                varianceStatus: 'GREEN',
            },
        });
    });

    it('rejects an opening meter that is greater than its closing value', async () => {
        txMock.shift.findUnique.mockResolvedValue(buildShift());

        const { PUT } = await import('../src/app/api/v2/gas/admin/meters/[shiftId]/route');
        const response = await PUT(buildRequest([111, 200, 300, 400]) as never, {
            params: Promise.resolve({ shiftId: 'shift-2' }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: expect.stringContaining('หัวจ่าย 1'),
        });
        expect(txMock.meterReading.update).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });
});
