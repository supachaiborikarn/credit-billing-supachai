/**
 * Gas Station Shift Utilities
 * 
 * Functions for shift management and validation
 */

import { toBangkokDateKey } from './date-utils';

export type ShiftNumber = 1 | 2;

export interface ShiftInfo {
    shiftNumber: ShiftNumber;
    name: string;
    startHour: number;
    endHour: number;
}

// Shift definitions
export const SHIFTS: Record<ShiftNumber, ShiftInfo> = {
    1: {
        shiftNumber: 1,
        name: 'กะเช้า',
        startHour: 6,
        endHour: 14
    },
    2: {
        shiftNumber: 2,
        name: 'กะบ่าย',
        startHour: 14,
        endHour: 22
    }
};

/**
 * Get current shift number based on current Bangkok time
 */
export function getCurrentShiftNumber(): ShiftNumber {
    const now = new Date();
    const bangkokHour = (now.getUTCHours() + 7) % 24;

    if (bangkokHour >= 6 && bangkokHour < 14) {
        return 1;
    }
    return 2;
}

/**
 * Get shift info by number
 */
export function getShiftInfo(shiftNumber: ShiftNumber): ShiftInfo {
    return SHIFTS[shiftNumber];
}

/**
 * Get shift name for display
 */
export function getShiftName(shiftNumber: number): string {
    if (shiftNumber === 1) return 'กะ 1 (เช้า)';
    if (shiftNumber === 2) return 'กะ 2 (บ่าย)';
    return `กะ ${shiftNumber}`;
}

/**
 * Check if a shift can be opened (no active shift exists)
 */
export function canOpenShift(existingShifts: { status: string }[]): boolean {
    return !existingShifts.some(s => s.status === 'OPEN');
}

/**
 * Validate shift close requirements
 */
export interface ShiftCloseValidation {
    valid: boolean;
    errors: string[];
}

export interface ShiftCloseData {
    hasEndMeters: boolean;
    hasEndGauge: boolean;
    hasReconciliation: boolean;
    metersCount: number;
    gaugeCount: number;
}

export function validateShiftClose(data: ShiftCloseData): ShiftCloseValidation {
    const errors: string[] = [];

    if (!data.hasEndMeters || data.metersCount < 4) {
        errors.push('ต้องบันทึกมิเตอร์ปิดกะให้ครบ 4 หัวจ่าย');
    }

    if (!data.hasEndGauge || data.gaugeCount < 3) {
        errors.push('ต้องบันทึกเกจปิดกะให้ครบ 3 ถัง');
    }

    if (!data.hasReconciliation) {
        errors.push('ต้องกรอกยอดเงินสด/เชื่อ/บัตร/โอน');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Generate unique shift identifier
 */
export function generateShiftKey(stationId: string, dateKey: string, shiftNumber: number): string {
    return `${stationId}-${dateKey}-shift${shiftNumber}`;
}

/**
 * Parse shift key back to components
 */
export function parseShiftKey(shiftKey: string): { stationId: string; dateKey: string; shiftNumber: number } | null {
    const match = shiftKey.match(/^(.+)-(\d{4}-\d{2}-\d{2})-shift(\d)$/);
    if (!match) return null;

    return {
        stationId: match[1],
        dateKey: match[2],
        shiftNumber: parseInt(match[3])
    };
}
