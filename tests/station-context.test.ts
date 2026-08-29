import { describe, expect, it } from 'vitest';
import {
    buildFullOpeningMeterEvidence,
    buildStationPermissions,
    canCreateStationTransaction,
    canMutateStationDailyPrices,
    canMutateStationMeterData,
    canMutateHistoricalStationData,
    getCanonicalStationPaths,
    isActiveOperationalStationId,
    isRetiredOperationalStationId,
    isStationRouteBoundToTransaction,
    resolveStationDefinition,
} from '@/lib/stations/station-context';

describe('station context', () => {
    it('resolves canonical station id and numeric route input', () => {
        expect(resolveStationDefinition('station-1')).toMatchObject({ id: 'station-1', number: 1, type: 'FULL', operationalStatus: 'ACTIVE' });
        expect(resolveStationDefinition('5')).toMatchObject({ id: 'station-5', number: 5, type: 'GAS', operationalStatus: 'ACTIVE' });
    });

    it('normalizes saved FULL opening-meter evidence for canonical recovery', () => {
        expect(buildFullOpeningMeterEvidence([
            { nozzleNumber: 1, startReading: 0, startPhoto: null },
            { nozzleNumber: 4, startReading: '4004.5', startPhoto: '  https://example.test/4.webp  ' },
            { nozzleNumber: 2, startReading: 2002, startPhoto: null },
            { nozzleNumber: 9, startReading: 9999, startPhoto: 'ignored.webp' },
        ])).toEqual([
            { nozzleNumber: 2, startReading: 2002, startPhoto: null },
            { nozzleNumber: 4, startReading: 4004.5, startPhoto: 'https://example.test/4.webp' },
        ]);
    });

    it('marks SIMPLE station 2/3/4 as retired', () => {
        expect(isRetiredOperationalStationId('station-2')).toBe(true);
        expect(isRetiredOperationalStationId('station-3')).toBe(true);
        expect(isRetiredOperationalStationId('station-4')).toBe(true);
        expect(isActiveOperationalStationId('station-5')).toBe(true);
    });

    it('blocks operational permissions for retired station while preserving history', () => {
        const station = resolveStationDefinition('station-2');
        expect(station).not.toBeNull();
        const permissions = buildStationPermissions({ role: 'STAFF', stationId: 'station-2' }, station!);
        expect(permissions).toMatchObject({ canView: true, canViewHistory: true, canOperate: false, canSell: false, canOpenShift: false, canCloseShift: false });
    });

    it('makes retired historical mutation admin-only while active station policy is unchanged', () => {
        expect(canMutateHistoricalStationData({ role: 'STAFF' }, 'station-2')).toBe(false);
        expect(canMutateHistoricalStationData({ role: 'STAFF' }, 'station-4')).toBe(false);
        expect(canMutateHistoricalStationData({ role: 'ADMIN' }, 'station-2')).toBe(true);
        expect(canMutateHistoricalStationData({ role: 'STAFF' }, 'station-1')).toBe(true);
        expect(canMutateHistoricalStationData({ role: 'STAFF' }, 'station-5')).toBe(true);
    });

    it('allows admin active operations and builds canonical paths', () => {
        const station = resolveStationDefinition('station-6');
        const permissions = buildStationPermissions({ role: 'ADMIN', stationId: null }, station!);
        expect(permissions.canOperate).toBe(true);
        expect(permissions.canManageStation).toBe(true);
        expect(getCanonicalStationPaths('station-6')).toEqual({
            base: '/stations/station-6',
            sales: '/stations/station-6/sales',
            operations: '/stations/station-6/operations',
            inventory: '/stations/station-6/inventory',
            history: '/stations/station-6/history',
        });
    });

    it('binds transaction routes to the transaction station', () => {
        expect(isStationRouteBoundToTransaction('2', 'station-2')).toBe(true);
        expect(isStationRouteBoundToTransaction('station-2', 'station-2')).toBe(true);
        expect(isStationRouteBoundToTransaction('3', 'station-2')).toBe(false);
        expect(isStationRouteBoundToTransaction('not-a-station', 'station-2')).toBe(false);
    });
});

describe('station daily price mutation policy', () => {
    it('allows active-station STAFF to set only the current business date', () => {
        expect(canMutateStationDailyPrices({ role: 'STAFF' }, 'station-1', '2026-08-28', '2026-08-28')).toBe(true);
        expect(canMutateStationDailyPrices({ role: 'STAFF' }, 'station-1', '2026-08-27', '2026-08-28')).toBe(false);
    });

    it('keeps retired-station STAFF read-only even for today while ADMIN can correct history', () => {
        expect(canMutateStationDailyPrices({ role: 'STAFF' }, 'station-2', '2026-08-28', '2026-08-28')).toBe(false);
        expect(canMutateStationDailyPrices({ role: 'ADMIN' }, 'station-2', '2026-08-27', '2026-08-28')).toBe(true);
        expect(canMutateStationDailyPrices({ role: 'ADMIN' }, 'station-1', '2026-08-27', '2026-08-28')).toBe(true);
    });
});

describe('station meter mutation policy', () => {
    it('allows active STAFF only on the current business date', () => {
        expect(canMutateStationMeterData({ role: 'STAFF' }, 'station-1', '2026-08-29', '2026-08-29')).toBe(true);
        expect(canMutateStationMeterData({ role: 'STAFF' }, 'station-1', '2026-08-28', '2026-08-29')).toBe(false);
        expect(canMutateStationMeterData({ role: 'STAFF' }, 'station-5', '2026-08-29', '2026-08-29')).toBe(true);
    });

    it('keeps retired STAFF read-only while ADMIN can correct history', () => {
        expect(canMutateStationMeterData({ role: 'STAFF' }, 'station-2', '2026-08-29', '2026-08-29')).toBe(false);
        expect(canMutateStationMeterData({ role: 'ADMIN' }, 'station-1', '2026-08-28', '2026-08-29')).toBe(true);
        expect(canMutateStationMeterData({ role: 'ADMIN' }, 'station-2', '2026-08-28', '2026-08-29')).toBe(true);
    });
});

describe('station transaction creation policy', () => {
    it('keeps active STAFF current-day creation but blocks historical creation', () => {
        expect(canCreateStationTransaction({ role: 'STAFF' }, 'station-1', '2026-08-29', '2026-08-29')).toBe(true);
        expect(canCreateStationTransaction({ role: 'STAFF' }, 'station-1', '2026-08-28', '2026-08-29')).toBe(false);
    });

    it('keeps retired STAFF read-only while ADMIN can explicitly create against history', () => {
        expect(canCreateStationTransaction({ role: 'STAFF' }, 'station-2', '2026-08-29', '2026-08-29')).toBe(false);
        expect(canCreateStationTransaction({ role: 'ADMIN' }, 'station-1', '2026-08-28', '2026-08-29')).toBe(true);
    });
});
