/**
 * Gas Station Meter Utilities
 * 
 * Functions for meter reading validation and calculations
 */

export const NOZZLE_COUNT = 4;

export interface MeterReading {
    nozzleNumber: number;
    startReading: number | null;
    endReading: number | null;
    soldQty: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface MeterValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate meter readings
 */
export function validateMeterReadings(readings: MeterReading[], type: 'start' | 'end'): MeterValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check all nozzles have readings
    for (let i = 1; i <= NOZZLE_COUNT; i++) {
        const reading = readings.find(r => r.nozzleNumber === i);
        if (!reading) {
            errors.push(`หัวจ่าย ${i}: ไม่มีข้อมูล`);
            continue;
        }

        const value = type === 'start' ? reading.startReading : reading.endReading;

        if (value === null || value === undefined) {
            errors.push(`หัวจ่าย ${i}: ต้องกรอกตัวเลข`);
        } else if (value < 0) {
            errors.push(`หัวจ่าย ${i}: ตัวเลขต้องมากกว่า 0`);
        }
    }

    // For end readings, check that end >= start
    if (type === 'end') {
        for (const reading of readings) {
            if (reading.startReading !== null && reading.endReading !== null) {
                if (reading.endReading < reading.startReading) {
                    errors.push(`หัวจ่าย ${reading.nozzleNumber}: ตัวเลขปิดกะต้องมากกว่าเปิดกะ`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Calculate sold quantity from start and end readings
 */
export function calculateSoldQty(startReading: number, endReading: number): number {
    return Math.max(0, endReading - startReading);
}

/**
 * Calculate total sold from all nozzles
 */
export function calculateTotalSold(readings: MeterReading[]): number {
    return readings.reduce((sum, r) => {
        if (r.soldQty !== null) {
            return sum + r.soldQty;
        }
        if (r.startReading !== null && r.endReading !== null) {
            return sum + calculateSoldQty(r.startReading, r.endReading);
        }
        return sum;
    }, 0);
}

/**
 * Format meter reading for display
 */
export function formatMeterReading(value: number | null): string {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Compare meter sold with transaction liters to detect discrepancy
 */
export function detectMeterDiscrepancy(
    meterSold: number,
    transactionLiters: number,
    threshold: number = 1
): { hasDiscrepancy: boolean; difference: number; percentage: number } {
    const difference = meterSold - transactionLiters;
    const percentage = transactionLiters > 0
        ? (difference / transactionLiters) * 100
        : 0;

    return {
        hasDiscrepancy: Math.abs(difference) > threshold,
        difference,
        percentage
    };
}
