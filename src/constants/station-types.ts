/**
 * Station Types - ประเภทสถานี
 * Synced with Prisma enum StationType
 */

export const StationType = {
    FULL: 'FULL',
    SIMPLE: 'SIMPLE',
    GAS: 'GAS',
} as const;

export type StationTypeValue = typeof StationType[keyof typeof StationType];

/**
 * Thai labels for station types
 */
export const StationTypeLabels: Record<StationTypeValue, string> = {
    FULL: 'ปั๊มเต็มรูปแบบ',
    SIMPLE: 'ปั๊มย่อย',
    GAS: 'ปั๊มแก๊ส',
};
