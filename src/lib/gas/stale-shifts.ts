import { STATIONS } from '@/constants';

export const GAS_STALE_SHIFT_CONFIRMATION = 'CLOSE_STALE_GAS_SHIFTS';

export type StaleShiftStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface StaleShiftCandidate {
    stationId: string;
    status: StaleShiftStatus;
    date: Date;
}

export function getGasStationIds(): string[] {
    return STATIONS
        .filter((station) => station.type === 'GAS')
        .map((station) => station.id);
}

export function isStaleGasOpenShift(
    shift: StaleShiftCandidate,
    cutoffDate: Date,
    gasStationIds = getGasStationIds()
): boolean {
    return shift.status === 'OPEN'
        && gasStationIds.includes(shift.stationId)
        && shift.date.getTime() < cutoffDate.getTime();
}

export function appendStaleShiftNote(existingNote: string | null | undefined, cleanupNote: string): string {
    return [existingNote, cleanupNote].filter(Boolean).join(' | ');
}
