import { prisma } from './prisma';

/**
 * Normalize license plate by removing Thai prefix, dashes, and spaces
 * e.g., "กพ82-0132" -> "820132", "82-0132" -> "820132"
 */
export function normalizePlate(plate: string): string {
    return plate.replace(/^[ก-ฮ]+/, '').replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Build a map of license plate (various formats) -> C-Code
 * Includes original plate, normalized plate, and split plates for รถพ่วง
 */
export async function buildTruckCodeMap(): Promise<Record<string, string>> {
    const trucks = await prisma.truck.findMany({
        where: { code: { not: null } },
        select: { licensePlate: true, code: true }
    });

    const truckCodeMap: Record<string, string> = {};

    trucks.forEach((t: { licensePlate: string; code: string | null }) => {
        if (t.code) {
            // Map by original plate
            truckCodeMap[t.licensePlate] = t.code;
            // Map by normalized plate
            truckCodeMap[normalizePlate(t.licensePlate)] = t.code;

            // Handle รถพ่วง format: กพ80-1278/กพ82-4004 -> map both parts
            if (t.licensePlate.includes('/')) {
                t.licensePlate.split('/').forEach(part => {
                    const trimmed = part.trim();
                    truckCodeMap[trimmed] = t.code!;
                    truckCodeMap[normalizePlate(trimmed)] = t.code!;
                });
            }
        }
    });

    return truckCodeMap;
}

/**
 * Find C-Code by license plate (tries various formats)
 */
export function findCodeByPlate(
    plate: string,
    truckCodeMap: Record<string, string>
): string | null {
    if (!plate) return null;

    // Try original
    if (truckCodeMap[plate]) return truckCodeMap[plate];

    // Try normalized
    const normalized = normalizePlate(plate);
    if (truckCodeMap[normalized]) return truckCodeMap[normalized];

    // Try with กพ prefix
    if (truckCodeMap['กพ' + normalized]) return truckCodeMap['กพ' + normalized];

    return null;
}
