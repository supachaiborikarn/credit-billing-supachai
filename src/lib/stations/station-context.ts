import { STATIONS, findStationIndex } from '@/constants';
import type {
    CanonicalStationId,
    StationCanonicalPaths,
    StationContextPermissions,
    StationOperationalStatus,
} from '@/types/station';

const ACTIVE_STATION_IDS = new Set<CanonicalStationId>(['station-1', 'station-5', 'station-6']);
const RETIRED_STATION_IDS = new Set<CanonicalStationId>(['station-2', 'station-3', 'station-4']);

export interface StationDefinition {
    id: CanonicalStationId;
    number: number;
    name: string;
    type: 'FULL' | 'SIMPLE' | 'GAS';
    operationalStatus: StationOperationalStatus;
    hasProducts: boolean;
}

export interface StationAccessUser {
    role: 'ADMIN' | 'STAFF';
    stationId: string | null;
}

export function isCanonicalStationId(value: string): value is CanonicalStationId {
    return /^station-[1-6]$/.test(value);
}

export function isActiveOperationalStationId(stationId: CanonicalStationId): boolean {
    return ACTIVE_STATION_IDS.has(stationId);
}

export function isRetiredOperationalStationId(stationId: CanonicalStationId): boolean {
    return RETIRED_STATION_IDS.has(stationId);
}

export function resolveStationDefinition(input: string): StationDefinition | null {
    const stationNumber = /^\d+$/.test(input) ? Number(input) : findStationIndex(input);
    if (!Number.isInteger(stationNumber) || stationNumber < 1 || stationNumber > STATIONS.length) {
        return null;
    }

    const station = STATIONS[stationNumber - 1];
    const id = station.id as CanonicalStationId;
    return {
        id,
        number: stationNumber,
        name: station.name,
        type: station.type,
        operationalStatus: isActiveOperationalStationId(id) ? 'ACTIVE' : 'RETIRED',
        hasProducts: 'hasProducts' in station ? Boolean(station.hasProducts) : false,
    };
}

export function getCanonicalStationPaths(stationId: CanonicalStationId): StationCanonicalPaths {
    const base = `/stations/${stationId}`;
    return {
        base,
        sales: `${base}/sales`,
        operations: `${base}/operations`,
        history: `${base}/history`,
    };
}

export function buildStationPermissions(
    user: StationAccessUser,
    station: StationDefinition
): StationContextPermissions {
    const canView = user.role === 'ADMIN' || user.stationId === station.id;
    const operational = station.operationalStatus === 'ACTIVE';
    const canOperate = canView && operational;

    return {
        canView,
        canViewHistory: canView,
        canOperate,
        canSell: canOperate,
        canOpenShift: canOperate,
        canCloseShift: canOperate,
        canManageStation: user.role === 'ADMIN',
    };
}
