import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    station: {
        findFirst: vi.fn(),
        update: vi.fn(),
    },
    dailyRecord: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    shift: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    station: {
        findMany: vi.fn(),
    },
    gasSettings: {
        findUnique: vi.fn(),
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

beforeEach(() => {
    resetMockTree(txMock);
    resetMockTree(prismaMock);
    requireAdminApiMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof txMock) => unknown) => callback(txMock));
    requireAdminApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
});

describe('gas admin operations route', () => {
    it('summarizes station prices and open-shift blockers', async () => {
        prismaMock.gasSettings.findUnique.mockResolvedValue({ value: '16.09' });
        prismaMock.station.findMany.mockResolvedValue([
            {
                id: 'station-5',
                name: 'ปั๊มแก๊สพงษ์อนันต์',
                gasPrice: 16.09,
                dailyRecords: [
                    {
                        id: 'daily-1',
                        date: new Date('2026-04-27T17:00:00.000Z'),
                        gasPrice: 16.49,
                        transactions: [{ id: 'tx-1', shiftId: 'shift-1' }],
                        shifts: [
                            {
                                id: 'shift-1',
                                shiftNumber: 1,
                                status: 'OPEN',
                                staff: { name: 'กุ้ง' },
                                createdAt: new Date('2026-04-28T03:22:36.778Z'),
                                closedAt: null,
                                meters: [
                                    { endReading: null },
                                    { endReading: null },
                                ],
                                transactions: [{ id: 'tx-1' }],
                                reconciliation: null,
                            },
                        ],
                    },
                ],
            },
        ]);

        const { GET } = await import('../src/app/api/v2/gas/admin/operations/route');
        const response = await GET(new Request('http://localhost/api/test?dateKey=2026-04-28') as never);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            dateKey: '2026-04-28',
            stations: [
                {
                    id: 'station-5',
                    stationGasPrice: 16.09,
                    todayGasPrice: 16.49,
                    effectiveGasPrice: 16.49,
                    openShiftId: 'shift-1',
                    nextShiftNumber: null,
                    shifts: [
                        {
                            shiftNumber: 1,
                            status: 'OPEN',
                            transactionCount: 1,
                            canForceCloseEmpty: false,
                        },
                    ],
                },
            ],
        });
    });

    it('updates today gas price and persists it as the station default', async () => {
        txMock.station.findFirst.mockResolvedValue({ id: 'station-5', gasPrice: 16.09 });
        txMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'daily-1',
            gasPrice: 16.09,
            retailPrice: 16.09,
            wholesalePrice: 16.09,
        });
        txMock.dailyRecord.update.mockResolvedValue({ id: 'daily-1', gasPrice: 16.49 });
        txMock.station.update.mockResolvedValue({});
        txMock.auditLog.create.mockResolvedValue({});

        const { PATCH } = await import('../src/app/api/v2/gas/admin/operations/route');
        const response = await PATCH(new Request('http://localhost/api/test', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'setGasPrice',
                stationId: 'station-5',
                gasPrice: 16.49,
                dateKey: '2026-04-28',
            }),
        }) as never);

        expect(response.status).toBe(200);
        expect(txMock.dailyRecord.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'daily-1' },
            data: {
                gasPrice: 16.49,
                retailPrice: 16.49,
                wholesalePrice: 16.49,
            },
        }));
        expect(txMock.station.update).toHaveBeenCalledWith({
            where: { id: 'station-5' },
            data: { gasPrice: 16.49 },
        });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                model: 'Station',
                recordId: 'station-5',
                newData: expect.objectContaining({
                    gasPrice: 16.49,
                    source: 'gas-admin-operations-price',
                }),
            }),
        }));
    });

    it('only force-closes empty open shifts', async () => {
        txMock.shift.findUnique.mockResolvedValue({
            id: 'shift-empty',
            status: 'OPEN',
            closedAt: null,
            varianceNote: null,
            shiftNumber: 2,
            dailyRecord: {
                stationId: 'station-6',
                date: new Date('2026-04-27T17:00:00.000Z'),
            },
            meters: [
                { endReading: null },
                { endReading: null },
            ],
            transactions: [],
            reconciliation: null,
        });
        txMock.shift.update.mockResolvedValue({ id: 'shift-empty', shiftNumber: 2 });
        txMock.auditLog.create.mockResolvedValue({});

        const { PATCH } = await import('../src/app/api/v2/gas/admin/operations/route');
        const response = await PATCH(new Request('http://localhost/api/test', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'closeEmptyShift',
                shiftId: 'shift-empty',
            }),
        }) as never);

        expect(response.status).toBe(200);
        expect(txMock.shift.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'shift-empty' },
            data: expect.objectContaining({
                status: 'CLOSED',
                closedById: 'admin-1',
                varianceNote: 'admin-empty-shift-close',
            }),
        }));
    });
});
