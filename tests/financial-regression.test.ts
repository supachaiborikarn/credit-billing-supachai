import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        transaction: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { getEndOfDayBangkok, getStartOfDayBangkok } from '../src/lib/date-utils';
import { suggestNextStationBill } from '../src/lib/station-bill-number';
import { summarizeShiftPayments } from '../src/lib/shift-transaction-utils';

describe('S44 financial regression invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps bill numbering station/book scoped, numeric, and zero-padded', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
            { billNo: '009' },
            { billNo: '010' },
            { billNo: 'ABC' },
            { billNo: null },
        ]);

        const result = await suggestNextStationBill('station-1', '830');

        expect(result).toEqual({ bookNo: '830', billNo: '011' });
        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith({
            where: {
                stationId: 'station-1',
                billBookNo: '830',
                billNo: { not: null },
                deletedAt: null,
                isVoided: false,
            },
            select: { billNo: true },
        });
    });

    it('uses the latest non-voided station bill book when no book is supplied', async () => {
        prismaMock.transaction.findFirst.mockResolvedValue({ billBookNo: '831' });
        prismaMock.transaction.findMany.mockResolvedValue([]);

        await expect(suggestNextStationBill('station-1')).resolves.toEqual({
            bookNo: '831',
            billNo: '1',
        });
        expect(prismaMock.transaction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                stationId: 'station-1',
                deletedAt: null,
                isVoided: false,
            }),
        }));
    });

    it('preserves every payment bucket used by FULL reconciliation', () => {
        const summary = summarizeShiftPayments([
            { paymentType: 'CASH', amount: 100 },
            { paymentType: 'CREDIT', amount: 200 },
            { paymentType: 'BOX_TRUCK', amount: 300 },
            { paymentType: 'OIL_TRUCK_SUPACHAI', amount: 400 },
            { paymentType: 'TRANSFER', amount: 500 },
            { paymentType: 'CREDIT_CARD', amount: 600 },
        ]);

        expect(summary).toEqual({
            cash: 100,
            credit: 900,
            transfer: 500,
            card: 600,
            boxTruck: 300,
            oilTruckSupachai: 400,
            total: 2100,
        });
    });

    it('keeps Bangkok calendar boundaries in UTC without leaking into adjacent days', () => {
        expect(getStartOfDayBangkok('2026-08-27').toISOString()).toBe('2026-08-26T17:00:00.000Z');
        expect(getEndOfDayBangkok('2026-08-27').toISOString()).toBe('2026-08-27T16:59:59.999Z');
    });
});
