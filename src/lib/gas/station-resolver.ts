/**
 * Gas Station Resolver Utility
 * 
 * Resolves station ID from multiple formats and validates GAS station type
 */

import { STATIONS, findStationIndex } from '@/constants';
import { prisma } from '@/lib/prisma';

export interface ResolvedStation {
    id: string;
    name: string;
    type: 'GAS';
    index: number;
    dbId: string; // Actual database ID (UUID)
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
            const aliases = 'aliases' in station ? station.aliases as readonly string[] : [];
            const dbId = aliases[0] || station.id;
            return {
                id: station.id,
                name: station.name,
                type: 'GAS',
                index: numericIndex,
                dbId
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
                const aliases = 'aliases' in station ? station.aliases as readonly string[] : [];
                const dbId = aliases[0] || station.id;
                return {
                    id: station.id,
                    name: station.name,
                    type: 'GAS',
                    index: idx,
                    dbId
                };
            }
        }
        return null;
    }

    // 3. Try as UUID alias from constants
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
                    dbId: stationIdOrIndex
                };
            }
        }
    }

    // 4. Try database lookup (for UUID matching)
    try {
        const dbStation = await prisma.station.findUnique({
            where: { id: stationIdOrIndex },
            select: { id: true, name: true, type: true }
        });

        if (dbStation && dbStation.type === 'GAS') {
            // Find index from constants
            let idx = -1;
            for (let i = 0; i < STATIONS.length; i++) {
                const s = STATIONS[i];
                if ('aliases' in s && (s.aliases as readonly string[]).includes(dbStation.id)) {
                    idx = i + 1;
                    break;
                }
            }
            return {
                id: idx > 0 ? STATIONS[idx - 1].id : dbStation.id,
                name: dbStation.name,
                type: 'GAS',
                index: idx,
                dbId: dbStation.id
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
 * Convert station index to database ID
 */
export function getStationDbId(stationIndex: number): string | null {
    if (stationIndex < 1 || stationIndex > STATIONS.length) return null;
    const station = STATIONS[stationIndex - 1];
    if ('aliases' in station && station.aliases) {
        return (station.aliases as readonly string[])[0] || station.id;
    }
    return station.id;
}
