/**
 * Shift Service - Anti-Fraud Features
 * 
 * 1. Shift Locking - ป้องกันแก้ไขหลังปิดกะ
 * 2. Reconciliation - สรุปยอดอัตโนมัติ
 * 3. Close Validation - ตรวจครบถ้วนก่อนปิด
 */

import { prisma } from '@/lib/prisma';
import { VARIANCE_THRESHOLD, getVarianceLevel } from '@/constants/thresholds';

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'LOCKED';
export type VarianceStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface CloseShiftValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ReconciliationData {
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    totalExpected: number;
    totalReceived: number;
    cashReceived: number;
    creditReceived: number;
    transferReceived: number;
    variance: number;
    varianceStatus: VarianceStatus;
}

/**
 * ตรวจสอบว่า shift ถูก lock แล้วหรือยัง
 */
export function isShiftLocked(status: ShiftStatus): boolean {
    return status === 'LOCKED';
}

/**
 * ตรวจสอบว่าสามารถแก้ไข shift ได้หรือไม่
 */
export function canModifyShift(status: ShiftStatus): boolean {
    return status === 'OPEN';
}

/**
 * ตรวจสอบความครบถ้วนก่อนปิดกะ
 */
export async function validateCloseShift(shiftId: string): Promise<CloseShiftValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            meters: true,
            dailyRecord: {
                include: {
                    station: true,
                }
            }
        }
    });

    if (!shift) {
        return { valid: false, errors: ['ไม่พบกะนี้'], warnings: [] };
    }

    // 1. ตรวจสอบว่ายังเปิดอยู่
    if (shift.status !== 'OPEN') {
        errors.push('กะนี้ปิดหรือล็อกไปแล้ว');
    }

    // 2. Skip meter validation for SIMPLE stations (no meters yet)
    const stationType = shift.dailyRecord?.station?.type;
    if (stationType !== 'SIMPLE') {
        // ตรวจสอบมิเตอร์ครบทุกหัว (สำหรับ FULL และ GAS เท่านั้น)
        const expectedNozzles = stationType === 'GAS' ? 4 : 4;
        const completedMeters = shift.meters.filter(m => m.endReading !== null);

        if (completedMeters.length < expectedNozzles) {
            errors.push(`มิเตอร์ยังไม่ครบ (${completedMeters.length}/${expectedNozzles} หัว)`);
        }

        // 3. ตรวจสอบมิเตอร์ไม่มีค่าติดลบ
        for (const meter of shift.meters) {
            if (meter.soldQty && Number(meter.soldQty) < 0) {
                errors.push(`มิเตอร์หัว ${meter.nozzleNumber} มียอดติดลบ`);
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
 * คำนวณ variance status จากยอดต่าง
 */
export function calculateVarianceStatus(variance: number): VarianceStatus {
    const absoluteVariance = Math.abs(variance);

    if (absoluteVariance > VARIANCE_THRESHOLD.RED) {
        return 'RED';
    }
    if (absoluteVariance > VARIANCE_THRESHOLD.YELLOW) {
        return 'YELLOW';
    }
    return 'GREEN';
}

/**
 * คำนวณยอดสรุป reconciliation
 */
export async function calculateReconciliation(shiftId: string): Promise<ReconciliationData> {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            meters: true,
            dailyRecord: {
                include: {
                    transactions: {
                        where: {
                            isVoided: false,
                            deletedAt: null
                        }
                    }
                }
            }
        }
    });

    if (!shift) {
        throw new Error('ไม่พบกะนี้');
    }

    // คำนวณยอด expected จากมิเตอร์
    const gasPrice = Number(shift.dailyRecord?.gasPrice || 15.50);
    const totalSoldLiters = shift.meters.reduce((sum, m) =>
        sum + (m.soldQty ? Number(m.soldQty) : 0), 0
    );
    const expectedFuelAmount = totalSoldLiters * gasPrice;

    // ยอดจากสินค้าอื่น (ถ้ามี)
    const expectedOtherAmount = 0; // TODO: implement when needed

    const totalExpected = expectedFuelAmount + expectedOtherAmount;

    // คำนวณยอดรับจริงจาก transactions
    const transactions = shift.dailyRecord?.transactions || [];

    const cashReceived = transactions
        .filter(t => t.paymentType === 'CASH')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const creditReceived = transactions
        .filter(t => ['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'].includes(t.paymentType))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const transferReceived = transactions
        .filter(t => ['TRANSFER', 'CREDIT_CARD'].includes(t.paymentType))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalReceived = cashReceived + creditReceived + transferReceived;
    const variance = totalExpected - totalReceived;
    const varianceStatus = calculateVarianceStatus(variance);

    return {
        expectedFuelAmount,
        expectedOtherAmount,
        totalExpected,
        totalReceived,
        cashReceived,
        creditReceived,
        transferReceived,
        variance,
        varianceStatus
    };
}

/**
 * ปิดกะพร้อมสร้าง reconciliation
 */
export async function closeShift(
    shiftId: string,
    userId: string,
    varianceNote?: string
): Promise<{ success: boolean; error?: string; reconciliation?: ReconciliationData }> {
    // 1. Validate
    const validation = await validateCloseShift(shiftId);
    if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
    }

    // 2. Calculate reconciliation
    const reconciliation = await calculateReconciliation(shiftId);

    // 3. Check if variance note is required
    if (reconciliation.varianceStatus !== 'GREEN' && !varianceNote) {
        return {
            success: false,
            error: `ยอดต่าง ${reconciliation.variance.toFixed(2)} บาท กรุณาระบุเหตุผล`
        };
    }

    // 4. Update shift and create reconciliation
    try {
        await prisma.$transaction([
            // Update shift status
            prisma.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date(),
                    closedById: userId,
                    varianceNote: varianceNote || null
                }
            }),
            // Create reconciliation snapshot
            prisma.shiftReconciliation.create({
                data: {
                    shiftId,
                    expectedFuelAmount: reconciliation.expectedFuelAmount,
                    expectedOtherAmount: reconciliation.expectedOtherAmount,
                    totalExpected: reconciliation.totalExpected,
                    totalReceived: reconciliation.totalReceived,
                    cashReceived: reconciliation.cashReceived,
                    creditReceived: reconciliation.creditReceived,
                    transferReceived: reconciliation.transferReceived,
                    variance: reconciliation.variance,
                    varianceStatus: reconciliation.varianceStatus
                }
            })
        ]);

        return { success: true, reconciliation };
    } catch (error) {
        console.error('[SHIFT] Close shift error:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการปิดกะ' };
    }
}

/**
 * ล็อกกะ (ป้องกันแก้ไขถาวร)
 */
export async function lockShift(shiftId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId }
        });

        if (!shift) {
            return { success: false, error: 'ไม่พบกะนี้' };
        }

        if (shift.status === 'OPEN') {
            return { success: false, error: 'ต้องปิดกะก่อนถึงจะล็อกได้' };
        }

        if (shift.status === 'LOCKED') {
            return { success: false, error: 'กะนี้ล็อกไปแล้ว' };
        }

        await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'LOCKED',
                lockedAt: new Date(),
                lockedById: userId
            }
        });

        return { success: true };
    } catch (error) {
        console.error('[SHIFT] Lock shift error:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการล็อกกะ' };
    }
}

/**
 * Middleware: ป้องกันการแก้ไขเมื่อ shift ถูก lock
 */
export async function checkShiftModifiable(shiftId: string): Promise<{ canModify: boolean; error?: string }> {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { status: true }
    });

    if (!shift) {
        return { canModify: false, error: 'ไม่พบกะนี้' };
    }

    if (shift.status === 'LOCKED') {
        return { canModify: false, error: 'กะนี้ถูกล็อกแล้ว ไม่สามารถแก้ไขได้' };
    }

    if (shift.status === 'CLOSED') {
        return { canModify: false, error: 'กะนี้ปิดแล้ว ไม่สามารถแก้ไขได้' };
    }

    return { canModify: true };
}
