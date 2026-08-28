import { describe, expect, it } from 'vitest';
import {
    buildStationPermissions,
    canMutateHistoricalStationData,
    getCanonicalStationPaths,
    isActiveOperationalStationId,
    isRetiredOperationalStationId,
    resolveStationDefinition,
} from '@/lib/stations/station-context';

describe('station context', () => {
    it('resolves canonical station id and numeric route input', () => {
        expect(resolveStationDefinition('station-1')).toMatchObject({ id: 'station-1', number: 1, type: 'FULL', operationalStatus: 'ACTIVE' });
        expect(resolveStationDefinition('5')).toMatchObject({ id: 'station-5', number: 5, type: 'GAS', operationalStatus: 'ACTIVE' });
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
            history: '/stations/station-6/history',
        });
    });
});
