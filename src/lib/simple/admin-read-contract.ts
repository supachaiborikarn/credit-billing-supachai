import { STATIONS } from '@/constants';

export const SIMPLE_ADMIN_STATIONS = STATIONS.filter((station) => station.type === 'SIMPLE');
export const SIMPLE_ADMIN_STATION_IDS = SIMPLE_ADMIN_STATIONS.map((station) => station.id);

export type SimpleAdminDaysResult =
    | { ok: true; days: number }
    | { ok: false; error: string };

export function parseSimpleAdminDays(raw: string | null, fallback = 7): SimpleAdminDaysResult {
    if (raw === null || raw === '') return { ok: true, days: fallback };
    if (!/^\d+$/.test(raw)) return { ok: false, error: 'days must be an integer from 1 to 90' };
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
        return { ok: false, error: 'days must be an integer from 1 to 90' };
    }
    return { ok: true, days };
}

export function isSimpleAdminStationId(stationId: string): boolean {
    return SIMPLE_ADMIN_STATION_IDS.includes(stationId as (typeof SIMPLE_ADMIN_STATION_IDS)[number]);
}
