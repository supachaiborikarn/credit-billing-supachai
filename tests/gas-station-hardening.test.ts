import { describe, expect, it } from 'vitest';
import {
    addToGasPaymentSummary,
    normalizeGasPaymentType,
} from '../src/lib/gas/payment-utils';
import {
    appendStaleShiftNote,
    getGasStationIds,
    isStaleGasOpenShift,
} from '../src/lib/gas/stale-shifts';

describe('gas station payment contract', () => {
    it('normalizes legacy CARD payloads to Prisma CREDIT_CARD', () => {
        expect(normalizeGasPaymentType('CARD')).toBe('CREDIT_CARD');
        expect(normalizeGasPaymentType('CREDIT_CARD')).toBe('CREDIT_CARD');
        expect(normalizeGasPaymentType('TRANSFER')).toBe('TRANSFER');
        expect(normalizeGasPaymentType('CHEQUE')).toBeNull();
    });

    it('aggregates all gas payment buckets', () => {
        const summary = { cash: 0, credit: 0, card: 0, transfer: 0 };

        addToGasPaymentSummary(summary, 'CASH', 100);
        addToGasPaymentSummary(summary, 'CREDIT', 200);
        addToGasPaymentSummary(summary, 'CARD', 300);
        addToGasPaymentSummary(summary, 'TRANSFER', 400);

        expect(summary).toEqual({
            cash: 100,
            credit: 200,
            card: 300,
            transfer: 400,
        });
    });
});

describe('gas stale shift cleanup rules', () => {
    it('selects only open gas shifts before the cutoff date', () => {
        const cutoff = new Date('2026-04-23T00:00:00.000Z');
        const gasStationIds = getGasStationIds();

        expect(gasStationIds).toEqual(['station-5', 'station-6']);
        expect(isStaleGasOpenShift({
            stationId: 'station-5',
            status: 'OPEN',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(true);

        expect(isStaleGasOpenShift({
            stationId: 'station-5',
            status: 'CLOSED',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(false);

        expect(isStaleGasOpenShift({
            stationId: 'station-1',
            status: 'OPEN',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(false);

        expect(isStaleGasOpenShift({
            stationId: 'station-6',
            status: 'OPEN',
            date: cutoff,
        }, cutoff, gasStationIds)).toBe(false);
    });

    it('appends cleanup audit context without losing the existing note', () => {
        expect(appendStaleShiftNote('old note', 'cleanup')).toBe('old note | cleanup');
        expect(appendStaleShiftNote(null, 'cleanup')).toBe('cleanup');
    });
});
