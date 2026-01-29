/**
 * Shift Service - Anti-Fraud Features
 * 
 * 1. Shift Locking - ป้องกันแก้ไขหลังปิดกะ
 * 2. Reconciliation - สรุปยอดอัตโนมัติ
 * 3. Close Validation - ตรวจครบถ้วนก่อนปิด
 */

import { prisma } from '@/lib/prisma';
import { VARIANCE_THRESHOLD, getVarianceLevel } from '@/constants/thresholds';
import { calculateProductSales } from './inventory-service';

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
        // GAS and FULL stations have 4 nozzles by default
        const EXPECTED_NOZZLES_PER_STATION = 4;
        const expectedNozzles = EXPECTED_NOZZLES_PER_STATION;
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

    // ยอดจากสินค้าอื่น
    const expectedOtherAmount = await calculateProductSales(shiftId);

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

/**
 * สร้างกะถัดไปพร้อม carry-over จากกะที่ปิด
 * - กะ 1 ปิด → สร้างกะ 2 วันเดียวกัน
 * - กะ 2 ปิด → สร้างกะ 1 วันถัดไป
 */
export async function createNextShiftWithCarryOver(
    closedShiftId: string,
    closingStock: number | null
): Promise<{ success: boolean; nextShiftId?: string; error?: string }> {
    try {
        const closedShift = await prisma.shift.findUnique({
            where: { id: closedShiftId },
            include: {
                meters: true,
                dailyRecord: true
            }
        });

        if (!closedShift || !closedShift.dailyRecord) {
            return { success: false, error: 'ไม่พบกะหรือ dailyRecord' };
        }

        const currentShiftNum = closedShift.shiftNumber;
        const nextShiftNumber = currentShiftNum === 1 ? 2 : 1;

        // Calculate next day's date for shift 2 -> shift 1 transition
        let nextDate: Date;
        if (currentShiftNum === 2) {
            // Shift 2 closes -> Create shift 1 for NEXT day
            const currentDate = new Date(closedShift.dailyRecord.date);
            currentDate.setDate(currentDate.getDate() + 1);
            // Import getStartOfDayBangkok dynamically to avoid circular deps
            const { getStartOfDayBangkok } = await import('@/lib/date-utils');
            nextDate = getStartOfDayBangkok(currentDate.toISOString().split('T')[0]);
        } else {
            // Shift 1 closes -> Create shift 2 for SAME day
            nextDate = closedShift.dailyRecord.date;
        }

        // Get or create daily record for next shift
        const nextDailyRecord = await prisma.dailyRecord.upsert({
            where: {
                stationId_date: {
                    stationId: closedShift.dailyRecord.stationId,
                    date: nextDate
                }
            },
            update: {},
            create: {
                stationId: closedShift.dailyRecord.stationId,
                date: nextDate,
                retailPrice: closedShift.dailyRecord.retailPrice,
                wholesalePrice: closedShift.dailyRecord.wholesalePrice,
                gasPrice: closedShift.dailyRecord.gasPrice,
                status: 'OPEN',
            }
        });

        // Check if next shift already exists
        const existingNextShift = await prisma.shift.findUnique({
            where: {
                dailyRecordId_shiftNumber: {
                    dailyRecordId: nextDailyRecord.id,
                    shiftNumber: nextShiftNumber
                }
            }
        });

        if (!existingNextShift) {
            // Create next shift with carried-over meter readings and stock
            const nextShift = await prisma.shift.create({
                data: {
                    dailyRecordId: nextDailyRecord.id,
                    shiftNumber: nextShiftNumber,
                    status: 'OPEN',
                    carryOverFromShiftId: closedShiftId,
                    openingStock: closingStock,
                    meters: {
                        create: closedShift.meters.map(m => ({
                            nozzleNumber: m.nozzleNumber,
                            startReading: m.endReading || m.startReading,
                        }))
                    }
                }
            });
            // Shift carry-over: Created next shift with startReadings and openingStock
            return { success: true, nextShiftId: nextShift.id };
        } else {
            // Update existing shift's meter startReadings (if they're still 0)
            for (const m of closedShift.meters) {
                if (m.endReading) {
                    await prisma.meterReading.updateMany({
                        where: {
                            shiftId: existingNextShift.id,
                            nozzleNumber: m.nozzleNumber,
                            startReading: 0,
                        },
                        data: {
                            startReading: m.endReading,
                        }
                    });
                }
            }
            // Shift carry-over: Updated existing shift startReadings
            return { success: true, nextShiftId: existingNextShift.id };
        }
    } catch (error) {
        console.error('[SHIFT SERVICE] Carry-over failed:', error);
        return { success: false, error: 'Carry-over failed' };
    }
}

