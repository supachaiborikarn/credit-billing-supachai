/**
 * Gas Station Resolver Utility
 * 
 * Resolves station ID from multiple formats and validates GAS station type
 * NOTE: dbId now returns station-X format (e.g., station-5) to match existing data
 */

import { STATIONS } from '@/constants';
import { prisma } from '@/lib/prisma';

export interface ResolvedStation {
    id: string;      // station-5, station-6
    name: string;
    type: 'GAS';
    index: number;   // 5, 6
    dbId: string;    // station-5, station-6 (for database queries)
}

/**
 * Resolve station ID and validate it's a GAS station
 * Supports: numeric index (5,6), station-X format, UUID alias
 * @returns Station info or null if not found/not GAS
 */
export async function resolveGasStation(stationIdOrIndex: string): Promise<ResolvedStation | null> {
    // 1. Try as numeric index (5, 6)
    const numericIndex = parseInt(stationIdOrIndex);
    if (!isNaN(numericIndex) && numericIndex >= 1 && numericIndex <= STATIONS.length) {
        const station = STATIONS[numericIndex - 1];
        if (station.type === 'GAS') {
            return {
                id: station.id,          // station-5
                name: station.name,
                type: 'GAS',
                index: numericIndex,     // 5
                dbId: station.id         // station-5 (NOT UUID!)
            };
        }
        return null; // Not a GAS station
    }

    // 2. Try as station-X format
    const stationMatch = stationIdOrIndex.match(/^station-(\d+)$/);
    if (stationMatch) {
        const idx = parseInt(stationMatch[1]);
        if (idx >= 1 && idx <= STATIONS.length) {
            const station = STATIONS[idx - 1];
            if (station.type === 'GAS') {
                return {
                    id: station.id,
                    name: station.name,
                    type: 'GAS',
                    index: idx,
                    dbId: station.id     // station-5 or station-6
                };
            }
        }
        return null;
    }

    // 3. Try as UUID alias from constants (resolve to station-X)
    for (let i = 0; i < STATIONS.length; i++) {
        const station = STATIONS[i];
        if (station.type === 'GAS' && 'aliases' in station) {
            const aliases = station.aliases as readonly string[];
            if (aliases.includes(stationIdOrIndex)) {
                return {
                    id: station.id,
                    name: station.name,
                    type: 'GAS',
                    index: i + 1,
                    dbId: station.id     // Return station-5 NOT the UUID!
                };
            }
        }
    }

    // 4. Try database lookup (station-X format in DB)
    try {
        const dbStation = await prisma.station.findUnique({
            where: { id: stationIdOrIndex },
            select: { id: true, name: true, type: true }
        });

        if (dbStation && dbStation.type === 'GAS') {
            // Extract index from station-X format
            const match = dbStation.id.match(/^station-(\d+)$/);
            const idx = match ? parseInt(match[1]) : -1;
            return {
                id: dbStation.id,
                name: dbStation.name,
                type: 'GAS',
                index: idx,
                dbId: dbStation.id  // station-5 or station-6
            };
        }
    } catch (error) {
        console.error('[resolveGasStation] DB lookup error:', error);
    }

    return null;
}

/**
 * Get error response for non-GAS station access attempt
 */
export function getNonGasStationError(): { error: string } {
    return {
        error: 'V2 API รองรับเฉพาะปั๊มแก๊สเท่านั้น (GAS stations only)'
    };
}

/**
 * Convert station index to database ID (station-X format)
 */
export function getStationDbId(stationIndex: number): string | null {
    if (stationIndex < 1 || stationIndex > STATIONS.length) return null;
    const station = STATIONS[stationIndex - 1];
    if (station.type !== 'GAS') return null;
    return station.id;  // station-5 or station-6
}
