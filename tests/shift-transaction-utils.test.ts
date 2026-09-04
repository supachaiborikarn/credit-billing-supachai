import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    transaction: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.transaction.findMany.mockResolvedValue([]);
});

describe('shift transaction window', () => {
    it('caps unscoped fallback transactions at the business-day end for a stale OPEN shift', async () => {
        const openedAt = new Date('2026-09-03T02:00:00.000Z');
        const businessDayEnd = new Date('2026-09-03T16:59:59.999Z');
        const { listTransactionsForShiftWindow } = await import('../src/lib/shift-transaction-utils');

        await listTransactionsForShiftWindow({
            shiftId: 'stale-open',
            stationId: 'station-1',
            openedAt,
            closedAt: null,
            fallbackClosedAt: businessDayEnd,
        });

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                OR: [
                    { shiftId: 'stale-open' },
                    {
                        shiftId: null,
                        date: { gte: openedAt, lte: businessDayEnd },
                    },
                ],
            }),
        }));
    });
});
