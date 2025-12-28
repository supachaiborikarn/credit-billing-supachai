/**
 * Threshold Constants - ค่าเกณฑ์สำหรับแจ้งเตือน
 * เอามาจาก supachaigroup project
 */

// Variance thresholds (ความแตกต่างของยอดเงิน)
export const VARIANCE_THRESHOLD = {
    /** เตือนเบาๆ - สีเหลือง */
    YELLOW: 200,
    /** เตือนรุนแรง - สีแดง */
    RED: 500,
} as const;

// Stock alerts (เตือนสต็อก)
export const STOCK_ALERT = {
    /** เตือนเมื่อน้ำมันต่ำกว่า (ลิตร) */
    FUEL_LOW: 1000,
    /** เตือนเมื่อแก๊สต่ำกว่า (ลิตร) */
    GAS_LOW: 500,
} as const;

// Transaction limits
export const TRANSACTION_LIMITS = {
    /** ยอดเงินสูงสุดต่อรายการ (บาท) */
    MAX_AMOUNT: 100000,
    /** จำนวนลิตรสูงสุดต่อรายการ */
    MAX_LITERS: 5000,
} as const;

/**
 * ตรวจสอบระดับความผิดปกติของยอดเงิน
 * @param variance ความแตกต่าง (บาท)
 * @returns 'ok' | 'warning' | 'critical'
 */
export function getVarianceLevel(variance: number): 'ok' | 'warning' | 'critical' {
    const absoluteVariance = Math.abs(variance);

    if (absoluteVariance >= VARIANCE_THRESHOLD.RED) {
        return 'critical';
    }
    if (absoluteVariance >= VARIANCE_THRESHOLD.YELLOW) {
        return 'warning';
    }
    return 'ok';
}

/**
 * สี CSS สำหรับแต่ละระดับ
 */
export const VARIANCE_COLORS = {
    ok: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50',
} as const;

/**
 * ข้อความแจ้งเตือนภาษาไทย
 */
export const VARIANCE_MESSAGES = {
    ok: 'ปกติ',
    warning: '⚠️ ยอดต่างเกินกำหนด',
    critical: '🚨 ยอดต่างมาก ต้องตรวจสอบ!',
} as const;
