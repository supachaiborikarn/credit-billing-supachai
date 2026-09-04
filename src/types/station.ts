export type CanonicalStationId =
    | 'station-1'
    | 'station-2'
    | 'station-3'
    | 'station-4'
    | 'station-5'
    | 'station-6';

export type CanonicalStationType = 'FULL' | 'SIMPLE' | 'GAS';
export type StationOperationalStatus = 'ACTIVE' | 'RETIRED';
export type StationOpeningStatus = 'NO_SHIFT' | 'NEEDS_OPENING_DATA' | 'READY' | 'DAY_COMPLETE';

export interface StationCurrentShift {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    businessDate: string;
    openedAt: string;
    closedAt: string | null;
    staffName: string | null;
}

export interface StationStaleShift extends StationCurrentShift {
    status: 'OPEN';
}

export interface StationOpeningMeterEvidence {
    nozzleNumber: number;
    startReading: number;
    startPhoto: string | null;
}

export interface StationOpeningState {
    status: StationOpeningStatus;
    requiredMeters: number;
    completedMeters: number;
    requiredGauges: number;
    completedGauges: number;
    requiresMeterPhotos: boolean;
    nextShiftNumber: 1 | 2 | null;
    fullMeters?: StationOpeningMeterEvidence[];
}

export interface StationContextPermissions {
    canView: boolean;
    canViewHistory: boolean;
    canOperate: boolean;
    canSell: boolean;
    canOpenShift: boolean;
    canCloseShift: boolean;
    canManageStation: boolean;
}

export interface StationCanonicalPaths {
    base: string;
    sales: string;
    operations: string;
    inventory: string;
    history: string;
}

export interface StationContextPayload {
    station: {
        id: CanonicalStationId;
        number: number;
        name: string;
        type: CanonicalStationType;
        operationalStatus: StationOperationalStatus;
        hasProducts: boolean;
    };
    currentShift: StationCurrentShift | null;
    staleShift: StationStaleShift | null;
    openingState: StationOpeningState;
    permissions: StationContextPermissions;
    paths: StationCanonicalPaths;
    user: {
        id: string;
        name: string;
        role: 'ADMIN' | 'STAFF';
        stationId: string | null;
    };
    capabilities: {
        saleFlow: boolean;
        shiftOperations: boolean;
        readOnlyHistory: boolean;
    };
    saleContext: {
        businessDate: string;
        retailPrice: number | null;
        wholesalePrice: number | null;
        gasPrice: number | null;
    } | null;
}
