import { describe, expect, it, vi } from 'vitest';
import {
    WATCHARA_STALE_AFTER_HOURS,
    getWatcharaDispenserDatabaseUrl,
    getWatcharaDispenserStaleInfo,
    normalizeWatcharaBusinessDate,
    validateWatcharaSyncDateRange,
} from '../src/lib/watchara-dispenser-utils';

describe('Watchara dispenser utils', () => {
    it('normalizes business date from the anchored external daily record timestamp', () => {
        const anchoredDate = new Date('2026-03-13T17:00:00.000Z');

        expect(normalizeWatcharaBusinessDate(anchoredDate)).toBe('2026-03-14');
    });

    it('marks source as stale after the configured threshold', () => {
        const now = new Date('2026-04-18T12:00:00.000Z');
        const staleAt = new Date(now.getTime() - (WATCHARA_STALE_AFTER_HOURS + 1) * 60 * 60 * 1000);

        const result = getWatcharaDispenserStaleInfo(staleAt, now);

        expect(result.isStale).toBe(true);
        expect(result.staleHours).not.toBeNull();
    });

    it('does not mark missing source timestamps as stale', () => {
        const result = getWatcharaDispenserStaleInfo(null, new Date('2026-04-18T12:00:00.000Z'));

        expect(result.isStale).toBe(false);
        expect(result.staleHours).toBeNull();
    });

    it('validates sync date range size inclusively', () => {
        const result = validateWatcharaSyncDateRange('2026-04-01', '2026-04-07');

        expect(result.dayCount).toBe(7);
    });

    it('rejects reversed date ranges', () => {
        expect(() => validateWatcharaSyncDateRange('2026-04-07', '2026-04-01')).toThrow(
            'endDate must be the same day or later than startDate'
        );
    });

    it('returns trimmed external database url', () => {
        vi.stubEnv('WATCHARA_DISPENSER_DATABASE_URL', '  postgresql://example  ');

        expect(getWatcharaDispenserDatabaseUrl()).toBe('postgresql://example');

        vi.unstubAllEnvs();
    });
});

it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(() => validateWatcharaSyncDateRange('2026-02-31', '2026-02-31')).toThrow('real YYYY-MM-DD calendar date');
});
