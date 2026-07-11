import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    dailyRecord: { findUnique: vi.fn() },
    transaction: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/operational-sales', () => ({
    getWatcharaExternalDailySummary: vi.fn().mockResolvedValue({
        summary: { liters: 0 },
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('FULL station daily anomaly meter scope', () => {
    it('uses the first day opening and final day closing instead of a split row with start zero', async () => {
        prismaMock.dailyRecord.findUnique.mockResolvedValue({
            station: { type: 'FULL' },
            meters: [],
            shifts: [
                {
                    id: 'shift-1',
                    shiftNumber: 1,
                    status: 'CLOSED',
                    meters: [{
                        nozzleNumber: 1,
                        startReading: 1_000,
                        endReading: null,
                        soldQty: null,
                        startPhoto: 'start-1',
                        endPhoto: null,
                    }],
                },
                {
                    id: 'shift-2',
                    shiftNumber: 2,
                    status: 'CLOSED',
                    meters: [{
                        nozzleNumber: 1,
                        startReading: 0,
                        endReading: 1_500,
                        soldQty: null,
                        startPhoto: null,
                        endPhoto: 'end-1',
                    }],
                },
            ],
        });
        prismaMock.transaction.findMany.mockResolvedValue([{ liters: 500 }]);

        const { checkDailyAnomaly } = await import('../src/services/daily-anomaly-detection');
        const result = await checkDailyAnomaly('station-1', new Date('2026-06-28T05:00:00.000Z'));

        expect(result).toMatchObject({
            hasAnomaly: false,
            meterTotal: 500,
            transTotal: 500,
            difference: 0,
        });
    });
});
