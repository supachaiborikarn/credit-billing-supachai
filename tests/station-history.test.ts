import { describe, expect, it } from 'vitest';
import {
    buildShiftGaugeHistory,
    getHistoryAttentionReasons,
    getStationHistoryRange,
    normalizeHistoryVariance,
    normalizeMeterTransactionDifferenceLiters,
} from '@/lib/stations/station-history';

describe('station history range', () => {
    it('defaults to a 30-day inclusive range', () => {
        expect(getStationHistoryRange({ today: '2026-08-27' })).toEqual({
            from: '2026-07-29',
            to: '2026-08-27',
            days: 30,
        });
    });

    it('rejects ranges longer than 93 days', () => {
        expect(() => getStationHistoryRange({
            from: '2026-01-01',
            to: '2026-08-27',
            today: '2026-08-27',
        })).toThrow('ไม่เกิน 93 วัน');
    });
});

describe('station history normalization', () => {
    it('pairs the latest start/end GAS gauge readings per shift and tank', () => {
        const gauges = buildShiftGaugeHistory([
            { tankNumber: 1, percentage: 40, photoUrl: 'old-start', shiftNumber: 2, notes: 'start', createdAt: '2026-08-27T01:00:00Z' },
            { tankNumber: 1, percentage: 42, photoUrl: 'new-start', shiftNumber: 2, notes: null, createdAt: '2026-08-27T02:00:00Z' },
            { tankNumber: 1, percentage: 31, photoUrl: 'end', shiftNumber: 2, notes: 'end', createdAt: '2026-08-27T10:00:00Z' },
            { tankNumber: 1, percentage: 99, photoUrl: null, shiftNumber: 1, notes: 'end', createdAt: '2026-08-27T10:00:00Z' },
        ], 2);

        expect(gauges).toEqual([{
            tankNumber: 1,
            startPercentage: 42,
            endPercentage: 31,
            startPhoto: 'new-start',
            endPhoto: 'end',
        }]);
    });

    it('marks only proven attention signals', () => {
        expect(getHistoryAttentionReasons({
            status: 'OPEN',
            anomalyCount: 1,
            dailyAnomaly: true,
            varianceStatus: 'RED',
        })).toEqual(['OPEN_SHIFT', 'METER_ANOMALY', 'DAILY_ANOMALY', 'RECONCILIATION_VARIANCE']);
        expect(getHistoryAttentionReasons({
            status: 'CLOSED',
            anomalyCount: 0,
            dailyAnomaly: false,
            varianceStatus: 'GREEN',
        })).toEqual([]);
    });

    it('normalizes FULL and GAS historical variance to received minus expected', () => {
        expect(normalizeHistoryVariance(1000, 980)).toBe(-20);
        expect(normalizeHistoryVariance(1000, 1025.555)).toBe(25.56);
    });

    it('normalizes meter minus transaction liters without inventing money values', () => {
        expect(normalizeMeterTransactionDifferenceLiters(10, 10)).toBe(0);
        expect(normalizeMeterTransactionDifferenceLiters(100.1239, 99.1)).toBe(1.024);
        expect(normalizeMeterTransactionDifferenceLiters('bad', 20)).toBe(0);
    });
});
