import { resolveStationDefinition } from './station-context';

const RETIRED_SIMPLE_STATION_NUMBERS = new Set(['2', '3', '4']);

export function getRetiredSimpleStationRedirect(stationNumber: string): string | null {
    const normalized = stationNumber.trim();
    if (!RETIRED_SIMPLE_STATION_NUMBERS.has(normalized)) return null;
    return `/stations/station-${normalized}`;
}

export function getRetiredSimpleStationHistoryRedirect(stationNumber: string): string | null {
    const base = getRetiredSimpleStationRedirect(stationNumber);
    return base ? `${base}/history` : null;
}

function isLegacyDateKey(value: string | null | undefined): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getRetiredSimpleMeterSummaryRedirect(stationNumber: string, selectedDate?: string | null): string | null {
    const history = getRetiredSimpleStationHistoryRedirect(stationNumber);
    if (!history) return null;
    if (!isLegacyDateKey(selectedDate)) return history;
    const query = new URLSearchParams({ from: selectedDate, to: selectedDate });
    return `${history}?${query.toString()}`;
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

export function getActiveGasOverviewRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'GAS' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}`;
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

export function getActiveFullHistoryRedirect(stationParam: string): string | null {
    const station = resolveStationDefinition(stationParam.trim());
    if (!station || station.type !== 'FULL' || station.operationalStatus !== 'ACTIVE') return null;
    return `/stations/${station.id}/history`;
}

export function getActiveFullMeterSummaryRedirect(stationParam: string): string | null {
    return getActiveFullHistoryRedirect(stationParam);
}
