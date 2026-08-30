import { STATIONS } from '@/constants';

export const PRODUCT_INVENTORY_STATION_IDS = STATIONS
    .filter((station) => 'hasProducts' in station && station.hasProducts === true)
    .map((station) => station.id) as string[];

export function isProductInventoryStationId(stationId: string): boolean {
    return PRODUCT_INVENTORY_STATION_IDS.includes(stationId);
}
