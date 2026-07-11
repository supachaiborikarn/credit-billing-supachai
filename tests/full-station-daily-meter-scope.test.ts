import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    dailyRecord: {
        findUnique: vi.fn(),
    },
    meterReading: {
        createMany: vi.fn(),
        findMany: vi.fn(),
    },
    transaction: {
        findMany: vi.fn(),
    },
};

const requireStationAccessApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/api-auth', () => ({
    requireStationAccessApi: requireStationAccessApiMock,
}));

vi.mock('@/lib/truck-utils', () => ({
    buildTruckCodeMap: vi.fn().mockResolvedValue(new Map()),
    findCodeByPlate: vi.fn().mockReturnValue(null),
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
    prismaMock.transaction.findMany.mockResolvedValue([]);
});

describe('full-station daily meter scope', () => {
    it('returns meter rows from the canonical open shift when a duplicate empty shift exists', async () => {
        const duplicateMeter = {
            id: 'meter-duplicate-1',
            shiftId: 'shift-1',
            nozzleNumber: 1,
            startReading: 0,
            endReading: null,
            startPhoto: 'same-start-photo.webp',
            endPhoto: null,
        };
        const canonicalMeters = [1, 2, 3, 4].map(nozzleNumber => ({
            id: `meter-canonical-${nozzleNumber}`,
            shiftId: 'shift-2',
            nozzleNumber,
            startReading: 6_000_000 + nozzleNumber,
            endReading: 6_000_100 + nozzleNumber,
            startPhoto: nozzleNumber === 1 ? 'same-start-photo.webp' : `start-${nozzleNumber}.webp`,
            endPhoto: `end-${nozzleNumber}.webp`,
        }));

        prismaMock.dailyRecord.findUnique
            .mockResolvedValueOnce({
                id: 'daily-1',
                stationId: 'station-1',
                date: new Date('2026-07-09T17:00:00.000Z'),
                status: 'OPEN',
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                meters: [duplicateMeter, ...canonicalMeters],
                shifts: [
                    {
                        id: 'shift-1',
                        shiftNumber: 1,
                        status: 'OPEN',
                        createdAt: new Date('2026-07-09T23:55:06.000Z'),
                        meters: [duplicateMeter],
                        _count: { transactions: 0 },
                    },
                    {
                        id: 'shift-2',
                        shiftNumber: 2,
                        status: 'OPEN',
                        createdAt: new Date('2026-07-09T23:55:07.000Z'),
                        meters: canonicalMeters,
                        _count: { transactions: 10 },
                    },
                ],
            })
            .mockResolvedValueOnce(null);

        const { GET } = await import('../src/app/api/station/[id]/daily/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/daily?date=2026-07-10') as never,
            { params: Promise.resolve({ id: '1' }) }
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.dailyRecord.meterShiftId).toBe('shift-2');
        expect(body.dailyRecord.meterStartShiftId).toBe('shift-2');
        expect(body.dailyRecord.meterEndShiftId).toBe('shift-2');
        expect(body.dailyRecord.meters).toHaveLength(4);
        expect(body.dailyRecord.meters[0]).toMatchObject({
            nozzleNumber: 1,
            startReading: 6_000_001,
            endReading: 6_000_101,
        });
    });

    it('keeps station-wide opening and closing meters when real sales span two shifts', async () => {
        const firstShiftMeters = [1, 2, 3, 4].map(nozzleNumber => ({
            id: `first-${nozzleNumber}`,
            shiftId: 'shift-1',
            nozzleNumber,
            startReading: 1_000 + nozzleNumber,
            endReading: null,
            startPhoto: `first-start-${nozzleNumber}.webp`,
            endPhoto: null,
        }));
        const secondShiftMeters = [1, 2, 3, 4].map(nozzleNumber => ({
            id: `second-${nozzleNumber}`,
            shiftId: 'shift-2',
            nozzleNumber,
            startReading: 0,
            endReading: 1_500 + nozzleNumber,
            startPhoto: null,
            endPhoto: `second-end-${nozzleNumber}.webp`,
        }));

        prismaMock.dailyRecord.findUnique
            .mockResolvedValueOnce({
                id: 'daily-split',
                stationId: 'station-1',
                date: new Date('2026-06-27T17:00:00.000Z'),
                status: 'OPEN',
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                meters: [...firstShiftMeters, ...secondShiftMeters],
                shifts: [
                    {
                        id: 'shift-1',
                        shiftNumber: 1,
                        status: 'CLOSED',
                        createdAt: new Date('2026-06-27T23:00:00.000Z'),
                        meters: firstShiftMeters,
                        _count: { transactions: 13 },
                    },
                    {
                        id: 'shift-2',
                        shiftNumber: 2,
                        status: 'CLOSED',
                        createdAt: new Date('2026-06-28T06:00:00.000Z'),
                        meters: secondShiftMeters,
                        _count: { transactions: 2 },
                    },
                ],
            })
            .mockResolvedValueOnce(null);

        const { GET } = await import('../src/app/api/station/[id]/daily/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/daily?date=2026-06-28') as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        const body = await response.json();

        expect(body.dailyRecord.meterShiftId).toBe('shift-2');
        expect(body.dailyRecord.meterStartShiftId).toBe('shift-1');
        expect(body.dailyRecord.meterEndShiftId).toBe('shift-2');
        expect(body.dailyRecord.meters[0]).toMatchObject({
            nozzleNumber: 1,
            startReading: 1_001,
            endReading: 1_501,
            startPhoto: 'first-start-1.webp',
            endPhoto: 'second-end-1.webp',
        });
        expect(body.dailyRecord.shiftMeters[0]).toMatchObject({
            nozzleNumber: 1,
            startReading: 0,
            endReading: 1_501,
        });
    });

    it('ignores an older stale OPEN row after the real later shift was closed', async () => {
        const staleMeter = {
            id: 'stale-meter',
            shiftId: 'shift-1',
            nozzleNumber: 1,
            startReading: 0,
            endReading: null,
            startPhoto: 'stale.webp',
            endPhoto: null,
        };
        const realMeters = [1, 2, 3, 4].map(nozzleNumber => ({
            id: `real-${nozzleNumber}`,
            shiftId: 'shift-2',
            nozzleNumber,
            startReading: 2_000 + nozzleNumber,
            endReading: 2_500 + nozzleNumber,
            startPhoto: `start-${nozzleNumber}.webp`,
            endPhoto: `end-${nozzleNumber}.webp`,
        }));

        prismaMock.dailyRecord.findUnique
            .mockResolvedValueOnce({
                id: 'daily-stale-open',
                stationId: 'station-1',
                date: new Date('2026-07-08T17:00:00.000Z'),
                status: 'OPEN',
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                meters: [staleMeter, ...realMeters],
                shifts: [
                    {
                        id: 'shift-1',
                        shiftNumber: 1,
                        status: 'OPEN',
                        createdAt: new Date('2026-07-08T23:00:00.000Z'),
                        meters: [staleMeter],
                        _count: { transactions: 0 },
                    },
                    {
                        id: 'shift-2',
                        shiftNumber: 2,
                        status: 'CLOSED',
                        createdAt: new Date('2026-07-08T23:00:01.000Z'),
                        meters: realMeters,
                        _count: { transactions: 8 },
                    },
                ],
            })
            .mockResolvedValueOnce(null);

        const { GET } = await import('../src/app/api/station/[id]/daily/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/daily?date=2026-07-09') as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        const body = await response.json();

        expect(body.dailyRecord.meterShiftId).toBe('shift-1');
        expect(body.dailyRecord.meterStartShiftId).toBe('shift-2');
        expect(body.dailyRecord.meterEndShiftId).toBe('shift-2');
        expect(body.dailyRecord.shiftMeters).toHaveLength(1);
        expect(body.dailyRecord.meters[0].startReading).toBe(2_001);
    });

    it('ignores a later empty OPEN duplicate after a substantive shift was closed', async () => {
        const realMeters = [1, 2, 3, 4].map(nozzleNumber => ({
            id: `closed-real-${nozzleNumber}`,
            shiftId: 'shift-1',
            nozzleNumber,
            startReading: 3_000 + nozzleNumber,
            endReading: 3_500 + nozzleNumber,
            startPhoto: `start-${nozzleNumber}.webp`,
            endPhoto: `end-${nozzleNumber}.webp`,
        }));
        const laterDuplicateMeter = {
            id: 'later-duplicate-meter',
            shiftId: 'shift-2',
            nozzleNumber: 1,
            startReading: 0,
            endReading: null,
            startPhoto: 'duplicate.webp',
            endPhoto: null,
        };

        prismaMock.dailyRecord.findUnique
            .mockResolvedValueOnce({
                id: 'daily-later-duplicate',
                stationId: 'station-1',
                date: new Date('2026-07-07T17:00:00.000Z'),
                status: 'OPEN',
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                meters: [...realMeters, laterDuplicateMeter],
                shifts: [
                    {
                        id: 'shift-1',
                        shiftNumber: 1,
                        status: 'CLOSED',
                        createdAt: new Date('2026-07-07T23:00:00.000Z'),
                        meters: realMeters,
                        _count: { transactions: 8 },
                    },
                    {
                        id: 'shift-2',
                        shiftNumber: 2,
                        status: 'OPEN',
                        createdAt: new Date('2026-07-07T23:00:01.000Z'),
                        meters: [laterDuplicateMeter],
                        _count: { transactions: 0 },
                    },
                ],
            })
            .mockResolvedValueOnce(null);

        const { GET } = await import('../src/app/api/station/[id]/daily/route');
        const response = await GET(
            new Request('http://localhost/api/station/1/daily?date=2026-07-08') as never,
            { params: Promise.resolve({ id: '1' }) }
        );
        const body = await response.json();

        expect(body.dailyRecord.meterShiftId).toBe('shift-2');
        expect(body.dailyRecord.meterStartShiftId).toBe('shift-1');
        expect(body.dailyRecord.meterEndShiftId).toBe('shift-1');
        expect(body.dailyRecord.meters).toHaveLength(4);
        expect(body.dailyRecord.meters[0].startReading).toBe(3_001);
    });
});
