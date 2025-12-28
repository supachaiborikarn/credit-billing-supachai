/**
 * Meter Service - รวม logic สำหรับระบบมิเตอร์
 * 
 * จัดการเรื่องการคำนวณยอดขาย, ตรวจสอบความถูกต้อง, anomaly detection
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface MeterReading {
    nozzleNumber: number;
    startReading: number | Decimal;
    endReading?: number | Decimal | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface MeterSaveResult {
    nozzleNumber: number;
    reading: number;
    soldQty?: number;
}

/**
 * คำนวณยอดขาย (sold quantity) จากมิเตอร์เปิด-ปิด
 * @param startReading มิเตอร์เปิด
 * @param endReading มิเตอร์ปิด
 * @returns ยอดขายเป็นลิตร หรือ null ถ้ายังไม่ได้ลงมิเตอร์ปิด
 */
export function calculateSoldQty(
    startReading: number | Decimal | null,
    endReading: number | Decimal | null
): number | null {
    if (startReading === null || endReading === null) {
        return null;
    }

    const start = Number(startReading);
    const end = Number(endReading);

    if (isNaN(start) || isNaN(end)) {
        return null;
    }

    return end - start;
}

/**
 * ตรวจสอบความถูกต้องของมิเตอร์
 * - endReading ต้อง >= startReading
 * - ค่าต้องไม่ติดลบ
 */
export function validateMeterReading(
    startReading: number,
    endReading: number
): { valid: boolean; error?: string } {
    if (startReading < 0) {
        return { valid: false, error: 'มิเตอร์เปิดต้องไม่ติดลบ' };
    }

    if (endReading < 0) {
        return { valid: false, error: 'มิเตอร์ปิดต้องไม่ติดลบ' };
    }

    if (endReading < startReading) {
        return { valid: false, error: 'มิเตอร์ปิดต้องมากกว่าหรือเท่ากับมิเตอร์เปิด' };
    }

    return { valid: true };
}

/**
 * ตรวจจับ anomaly ของยอดขาย
 * @param soldQty ยอดขาย
 * @param averageSoldQty ค่าเฉลี่ยยอดขาย
 * @param threshold เปอร์เซ็นต์ที่ถือว่าผิดปกติ (default 50%)
 */
export function detectMeterAnomaly(
    soldQty: number,
    averageSoldQty: number,
    threshold: number = 50
): { isAnomaly: boolean; message?: string; percentDiff?: number } {
    if (averageSoldQty === 0) {
        return { isAnomaly: false };
    }

    const percentDiff = ((soldQty - averageSoldQty) / averageSoldQty) * 100;

    if (Math.abs(percentDiff) > threshold) {
        const direction = percentDiff > 0 ? 'สูงกว่า' : 'ต่ำกว่า';
        return {
            isAnomaly: true,
            message: `ยอดขาย${direction}ค่าเฉลี่ย ${Math.abs(percentDiff).toFixed(0)}%`,
            percentDiff
        };
    }

    return { isAnomaly: false, percentDiff };
}

/**
 * ตรวจสอบว่าเลขมิเตอร์ต่อเนื่องจากกะก่อนหน้าหรือไม่
 */
export function checkMeterContinuity(
    previousEndReading: number | null,
    currentStartReading: number
): { isContinuous: boolean; gap?: number } {
    if (previousEndReading === null) {
        return { isContinuous: true };
    }

    const gap = currentStartReading - previousEndReading;

    // Allow small tolerance (0.01 liters)
    if (Math.abs(gap) > 0.01) {
        return { isContinuous: false, gap };
    }

    return { isContinuous: true };
}

/**
 * สร้าง data สำหรับบันทึกมิเตอร์
 */
export function prepareMeterSaveData(
    type: 'start' | 'end',
    reading: number,
    existingStartReading?: number | null,
    userId?: string
): {
    startReading?: number;
    endReading?: number | null;
    soldQty?: number | null;
    capturedById?: string;
    capturedAt?: Date;
} {
    const now = new Date();

    if (type === 'start') {
        return {
            startReading: reading,
            capturedById: userId,
            capturedAt: now,
        };
    }

    // type === 'end'
    const startReading = existingStartReading ?? 0;
    const soldQty = calculateSoldQty(startReading, reading);

    return {
        endReading: reading,
        soldQty: soldQty,
        capturedById: userId,
        capturedAt: now,
    };
}
