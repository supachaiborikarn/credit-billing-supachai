import { describe, expect, it } from 'vitest';
import { canCreateFullHistoryTransaction } from '@/lib/stations/full-history-maintenance';

describe('FULL history maintenance policy', () => {
    it('exposes historical create only for an existing OPEN day with an existing OPEN shift', () => {
        expect(canCreateFullHistoryTransaction({
            status: 'OPEN',
            meterShiftId: 'shift-1',
            meterShiftStatus: 'OPEN',
        })).toBe(true);

        expect(canCreateFullHistoryTransaction(null)).toBe(false);
        expect(canCreateFullHistoryTransaction({
            status: 'OPEN',
            meterShiftId: null,
            meterShiftStatus: null,
        })).toBe(false);
        expect(canCreateFullHistoryTransaction({
            status: 'CLOSED',
            meterShiftId: 'shift-1',
            meterShiftStatus: 'CLOSED',
        })).toBe(false);
    });
});
