import { describe, expect, it } from 'vitest';
import { STATIONS } from '../src/constants';
import {
    getActiveFullOperationsRedirect,
    getActiveFullOverviewRedirect,
    getActiveFullSellRedirect,
    getActiveGasSellRedirect,
    getRetiredSimpleStationRedirect,
} from '../src/lib/stations/legacy-route-retirement';

const gasAliasCases = STATIONS.flatMap((station) =>
    station.type === 'GAS' && 'aliases' in station
        ? station.aliases.map((alias) => [alias, `/stations/${station.id}/sales`] as const)
        : []
);

describe('legacy route retirement', () => {
    it.each(['2', '3', '4'])('redirects retired SIMPLE station %s to canonical read-only workspace', (stationNumber) => {
        expect(getRetiredSimpleStationRedirect(stationNumber)).toBe(`/stations/station-${stationNumber}`);
    });

    it.each(['1', '5', '6', '7', ''])('does not redirect non-retired station %s', (stationNumber) => {
        expect(getRetiredSimpleStationRedirect(stationNumber)).toBeNull();
    });

    it.each([
        ['5', '/stations/station-5/sales'],
        ['6', '/stations/station-6/sales'],
        ['station-5', '/stations/station-5/sales'],
        ['station-6', '/stations/station-6/sales'],
    ])('redirects active GAS sell param %s to canonical sales', (stationParam, expected) => {
        expect(getActiveGasSellRedirect(stationParam)).toBe(expected);
    });

    it.each(gasAliasCases)('redirects GAS alias to canonical sales', (stationParam, expected) => {
        expect(getActiveGasSellRedirect(stationParam)).toBe(expected);
    });

    it.each(['1', '2', '3', '4', '7', '', 'station-2'])('does not redirect non-GAS sell param %s', (stationParam) => {
        expect(getActiveGasSellRedirect(stationParam)).toBeNull();
    });

    it.each([
        ['1', '/stations/station-1'],
        ['station-1', '/stations/station-1'],
    ])('redirects active FULL overview param %s to canonical station overview', (stationParam, expected) => {
        expect(getActiveFullOverviewRedirect(stationParam)).toBe(expected);
    });

    it.each(['2', '3', '4', '5', '6', '7', '', 'station-5'])('does not redirect non-FULL overview param %s', (stationParam) => {
        expect(getActiveFullOverviewRedirect(stationParam)).toBeNull();
    });

    it.each([
        ['1', '/stations/station-1/sales'],
        ['station-1', '/stations/station-1/sales'],
    ])('redirects active FULL sell param %s to canonical sales', (stationParam, expected) => {
        expect(getActiveFullSellRedirect(stationParam)).toBe(expected);
    });

    it.each(['2', '3', '4', '5', '6', '7', '', 'station-5'])('does not redirect non-FULL sell param %s', (stationParam) => {
        expect(getActiveFullSellRedirect(stationParam)).toBeNull();
    });

    it.each([
        ['1', '/stations/station-1/operations'],
        ['station-1', '/stations/station-1/operations'],
    ])('redirects active FULL operations param %s to canonical operations', (stationParam, expected) => {
        expect(getActiveFullOperationsRedirect(stationParam)).toBe(expected);
    });

    it.each(['2', '3', '4', '5', '6', '7', '', 'station-5'])('does not redirect non-FULL operations param %s', (stationParam) => {
        expect(getActiveFullOperationsRedirect(stationParam)).toBeNull();
    });
});
