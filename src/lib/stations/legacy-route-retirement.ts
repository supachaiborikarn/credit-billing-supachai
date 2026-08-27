import { resolveStationDefinition } from './station-context';

const RETIRED_SIMPLE_STATION_NUMBERS = new Set(['2', '3', '4']);

export function getRetiredSimpleStationRedirect(stationNumber: string): string | null {
    const normalized = stationNumber.trim();
    if (!RETIRED_SIMPLE_STATION_NUMBERS.has(normalized)) return null;
    return `/stations/station-${normalized}`;
}

export function getActiveGasSellRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'GAS' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}/sales`;
}

export function getActiveGasOperationsRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'GAS' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}/operations`;
}

export function getActiveFullOverviewRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'FULL' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}`;
}

export function getActiveFullSellRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'FULL' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}/sales`;
}

export function getActiveFullOperationsRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'FULL' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}/operations`;
}
