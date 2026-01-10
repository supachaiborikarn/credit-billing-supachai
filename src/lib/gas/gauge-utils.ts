/**
 * Gas Station Gauge Utilities
 * 
 * Functions for gauge (tank level) validation and calculations
 */

export const TANK_COUNT = 3;
export const TANK_CAPACITY = 2400; // liters per tank
export const TOTAL_CAPACITY = TANK_COUNT * TANK_CAPACITY; // 7200 liters

export interface GaugeReading {
    tankNumber: number;
    percentage: number;
    photoUrl?: string | null;
}

export interface GaugeValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate gauge readings
 */
export function validateGaugeReadings(readings: GaugeReading[], type: 'start' | 'end'): GaugeValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check all tanks have readings
    for (let i = 1; i <= TANK_COUNT; i++) {
        const reading = readings.find(r => r.tankNumber === i);
        if (!reading) {
            errors.push(`ถัง ${i}: ไม่มีข้อมูล`);
            continue;
        }

        if (reading.percentage === null || reading.percentage === undefined) {
            errors.push(`ถัง ${i}: ต้องกรอกเปอร์เซ็นต์`);
        } else if (reading.percentage < 0 || reading.percentage > 100) {
            errors.push(`ถัง ${i}: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100`);
        }

        // Warning for low levels
        if (reading.percentage !== null && reading.percentage < 20) {
            warnings.push(`ถัง ${i}: ระดับต่ำกว่า 20%`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Calculate liters from percentage
 */
export function percentageToLiters(percentage: number): number {
    return Math.round((percentage / 100) * TANK_CAPACITY);
}

/**
 * Calculate total stock from all tanks
 */
export function calculateTotalStock(readings: GaugeReading[]): number {
    return readings.reduce((sum, r) => sum + percentageToLiters(r.percentage), 0);
}

/**
 * Calculate average percentage across all tanks
 */
export function calculateAveragePercentage(readings: GaugeReading[]): number {
    if (readings.length === 0) return 0;
    const total = readings.reduce((sum, r) => sum + r.percentage, 0);
    return Math.round((total / readings.length) * 10) / 10;
}

/**
 * Get color class based on percentage level
 */
export function getGaugeColorClass(percentage: number): string {
    if (percentage >= 70) return 'text-green-400';
    if (percentage >= 40) return 'text-yellow-400';
    if (percentage >= 20) return 'text-orange-400';
    return 'text-red-400';
}

/**
 * Get background color class for gauge visual
 */
export function getGaugeBgClass(percentage: number): string {
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    if (percentage >= 20) return 'bg-orange-500';
    return 'bg-red-500';
}

/**
 * Format gauge percentage for display
 */
export function formatGaugePercentage(percentage: number): string {
    return `${Math.round(percentage)}%`;
}

/**
 * Format liters for display
 */
export function formatLiters(liters: number): string {
    return liters.toLocaleString('th-TH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }) + ' L';
}
