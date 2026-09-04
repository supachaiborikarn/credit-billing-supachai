import { STATIONS, findStationIndex } from '@/constants';
import type {
    CanonicalStationId,
    StationCanonicalPaths,
    StationContextPermissions,
    StationOpeningMeterEvidence,
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

export interface FullOpeningMeterEvidenceRow {
    nozzleNumber: number;
    startReading: unknown;
    startPhoto: string | null;
}

export function buildFullOpeningMeterEvidence(
    rows: FullOpeningMeterEvidenceRow[]
): StationOpeningMeterEvidence[] {
    const byNozzle = new Map<number, StationOpeningMeterEvidence>();

    for (const row of rows) {
        if (![1, 2, 3, 4].includes(row.nozzleNumber)) continue;
        const startReading = Number(row.startReading);
        const startPhoto = typeof row.startPhoto === 'string' && row.startPhoto.trim()
            ? row.startPhoto.trim()
            : null;

        // The legacy daily-record flow pre-creates zero-valued rows. They are
        // placeholders, not user-entered recovery evidence, until a reading or
        // photo has actually been captured.
        if ((!Number.isFinite(startReading) || startReading === 0) && !startPhoto) continue;

        byNozzle.set(row.nozzleNumber, {
            nozzleNumber: row.nozzleNumber,
            startReading: Number.isFinite(startReading) ? startReading : 0,
            startPhoto,
        });
    }

    return [...byNozzle.values()].sort((left, right) => left.nozzleNumber - right.nozzleNumber);
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

export function isRetiredOperationalStationInput(input: string): boolean {
    return resolveStationDefinition(input)?.operationalStatus === 'RETIRED';
}

export function canMutateHistoricalStationData(user: Pick<StationAccessUser, 'role'>, stationId: string): boolean {
    return user.role === 'ADMIN' || !isRetiredOperationalStationInput(stationId);
}

export function canMutateStationDailyPrices(
    user: Pick<StationAccessUser, 'role'>,
    stationId: string,
    businessDate: string,
    today: string
): boolean {
    if (user.role === 'ADMIN') return true;
    if (isRetiredOperationalStationInput(stationId)) return false;
    return businessDate === today;
}

export function canMutateStationMeterData(
    user: Pick<StationAccessUser, 'role'>,
    stationId: string,
    businessDate: string,
    today: string
): boolean {
    if (user.role === 'ADMIN') return true;
    if (isRetiredOperationalStationInput(stationId)) return false;
    return businessDate === today;
}

export function canCompleteOpenFullStationShift(
    stationId: string,
    businessDate: string,
    today: string,
    meterType: string,
    shiftStatus: string | null | undefined
): boolean {
    return stationId === 'station-1'
        && businessDate !== today
        && meterType === 'end'
        && shiftStatus === 'OPEN';
}

export function canCreateStationTransaction(
    user: Pick<StationAccessUser, 'role'>,
    stationId: string,
    businessDate: string,
    today: string
): boolean {
    if (user.role === 'ADMIN') return true;
    if (isRetiredOperationalStationInput(stationId)) return false;
    return businessDate === today;
}

export function isStationRouteBoundToTransaction(routeStationInput: string, transactionStationId: string): boolean {
    return resolveStationDefinition(routeStationInput)?.id === transactionStationId;
}

export function getCanonicalStationPaths(stationId: CanonicalStationId): StationCanonicalPaths {
    const base = `/stations/${stationId}`;
    return {
        base,
        sales: `${base}/sales`,
        operations: `${base}/operations`,
        inventory: `${base}/inventory`,
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
