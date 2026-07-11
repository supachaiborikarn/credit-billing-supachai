import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const txMock = {
    shift: {
        findMany: vi.fn(),
        create: vi.fn(),
    },
    dailyRecord: {
        findUnique: vi.fn(),
    },
    meterReading: {
        updateMany: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (
        callback: (client: typeof txMock) => unknown
    ) => callback(txMock));
    txMock.meterReading.updateMany.mockResolvedValue({ count: 0 });
});

describe('ensureOpenFullStationShiftForDailyRecord', () => {
    it('uses the open shift with real activity when an empty duplicate exists', async () => {
        txMock.shift.findMany.mockResolvedValue([
            {
                id: 'shift-empty',
                dailyRecordId: 'daily-1',
                shiftNumber: 1,
                status: 'OPEN',
                createdAt: new Date('2026-07-09T23:55:06.000Z'),
                meters: [{ startReading: 0, endReading: null, startPhoto: 'same.webp', endPhoto: null }],
                _count: { transactions: 0 },
            },
            {
                id: 'shift-real',
                dailyRecordId: 'daily-1',
                shiftNumber: 2,
                status: 'OPEN',
                createdAt: new Date('2026-07-09T23:55:07.000Z'),
                meters: [1, 2, 3, 4].map(nozzle => ({
                    startReading: 1_000 + nozzle,
                    endReading: null,
                    startPhoto: `start-${nozzle}.webp`,
                    endPhoto: null,
                })),
                _count: { transactions: 10 },
            },
        ]);

        const { ensureOpenFullStationShiftForDailyRecord } = await import('../src/lib/full-station-shift-sync');
        const shift = await ensureOpenFullStationShiftForDailyRecord({
            dailyRecordId: 'daily-1',
            userId: 'staff-1',
            requireStartedMeters: false,
        });

        expect(shift?.id).toBe('shift-real');
        expect(txMock.shift.create).not.toHaveBeenCalled();
        expect(txMock.meterReading.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ shiftId: 'shift-real' }),
        }));
        expect(prismaMock.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
    });

    it('retries the atomic create when PostgreSQL reports a serialization race', async () => {
        const raceError = new Prisma.PrismaClientKnownRequestError('serialization race', {
            code: 'P2034',
            clientVersion: '5.22.0',
        });
        prismaMock.$transaction
            .mockRejectedValueOnce(raceError)
            .mockImplementationOnce(async (callback: (client: typeof txMock) => unknown) => callback(txMock));
        txMock.shift.findMany.mockResolvedValue([
            {
                id: 'shift-created-by-other-request',
                dailyRecordId: 'daily-1',
                shiftNumber: 1,
                status: 'OPEN',
                createdAt: new Date(),
                meters: [],
                _count: { transactions: 0 },
            },
        ]);

        const { ensureOpenFullStationShiftForDailyRecord } = await import('../src/lib/full-station-shift-sync');
        const shift = await ensureOpenFullStationShiftForDailyRecord({
            dailyRecordId: 'daily-1',
            requireStartedMeters: false,
        });

        expect(shift?.id).toBe('shift-created-by-other-request');
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
        expect(txMock.shift.create).not.toHaveBeenCalled();
    });
});
