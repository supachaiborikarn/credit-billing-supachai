/**
 * Daily Anomaly Detection Service
 * 
 * ตรวจจับความผิดปกติของยอดขายรายวัน (สำหรับ stations ที่ไม่ใช้ระบบกะ)
 * - เปรียบเทียบยอดรวม transactions กับยอดรวม meterReading
 * - บันทึก anomaly ถ้าผลต่างเกิน threshold
 */

import { prisma } from '@/lib/prisma';

const WARNING_THRESHOLD = 10;   // ผลต่าง 10 ลิตร = WARNING
const CRITICAL_THRESHOLD = 50;  // ผลต่าง 50 ลิตร = CRITICAL

export interface DailyAnomalyResult {
    hasAnomaly: boolean;
    meterTotal: number;
    transTotal: number;
    difference: number;
    severity?: 'WARNING' | 'CRITICAL';
}

/**
 * ตรวจสอบ anomaly รายวันของ station
 * @param stationId Station ID
 * @param date วันที่ต้องการตรวจสอบ
 */
export async function checkDailyAnomaly(
    stationId: string,
    date: Date
): Promise<DailyAnomalyResult> {
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get meter total for the day
    const meterReadings = await prisma.meterReading.findMany({
        where: {
            dailyRecord: {
                stationId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        },
        select: {
            startReading: true,
            endReading: true,
            soldQty: true
        }
    });

    // Calculate meter total - use soldQty if available, otherwise calculate from readings
    const meterTotal = meterReadings.reduce((sum, r) => {
        if (r.soldQty !== null) {
            return sum + Number(r.soldQty);
        } else if (r.endReading !== null && r.startReading !== null) {
            return sum + (Number(r.endReading) - Number(r.startReading));
        }
        return sum;
    }, 0);

    // Get transaction total for the day
    // Use 'date' field instead of 'createdAt' to correctly count retroactive transactions
    const transactions = await prisma.transaction.findMany({
        where: {
            stationId,
            date: {
                gte: startOfDay,
                lte: endOfDay
            },
            isVoided: { not: true }
        },
        select: { liters: true }
    });

    const transTotal = transactions.reduce((sum, t) => sum + Number(t.liters || 0), 0);

    // Calculate difference
    const difference = transTotal - meterTotal;
    const absDiff = Math.abs(difference);

    // Determine severity
    let hasAnomaly = false;
    let severity: 'WARNING' | 'CRITICAL' | undefined;

    if (absDiff >= CRITICAL_THRESHOLD) {
        hasAnomaly = true;
        severity = 'CRITICAL';
    } else if (absDiff >= WARNING_THRESHOLD) {
        hasAnomaly = true;
        severity = 'WARNING';
    }

    return {
        hasAnomaly,
        meterTotal,
        transTotal,
        difference,
        severity
    };
}

/**
 * ตรวจสอบและบันทึก anomaly รายวัน
 * @param stationId Station ID
 * @param date วันที่ต้องการตรวจสอบ
 */
export async function checkAndSaveDailyAnomaly(
    stationId: string,
    date: Date
): Promise<{ success: boolean; result: DailyAnomalyResult; saved: boolean; deleted?: boolean }> {
    const result = await checkDailyAnomaly(stationId, date);

    // Get date only for database lookup
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (!result.hasAnomaly) {
        // No anomaly - check if there's an existing record to delete
        const existing = await prisma.dailyAnomaly.findUnique({
            where: {
                stationId_date: {
                    stationId,
                    date: dateOnly
                }
            }
        });

        if (existing) {
            // Data was corrected - delete the old anomaly record
            await prisma.dailyAnomaly.delete({
                where: { id: existing.id }
            });
            console.log(`[DailyAnomaly] Deleted resolved anomaly for ${stationId} on ${dateOnly.toISOString().split('T')[0]}`);
            return { success: true, result, saved: false, deleted: true };
        }

        return { success: true, result, saved: false };
    }

    // Check if already exists (dateOnly already declared above)

    const existing = await prisma.dailyAnomaly.findUnique({
        where: {
            stationId_date: {
                stationId,
                date: dateOnly
            }
        }
    });

    if (existing) {
        // Update existing
        await prisma.dailyAnomaly.update({
            where: { id: existing.id },
            data: {
                meterTotal: result.meterTotal,
                transTotal: result.transTotal,
                difference: result.difference,
                severity: result.severity
            }
        });
    } else {
        // Create new
        await prisma.dailyAnomaly.create({
            data: {
                stationId,
                date: dateOnly,
                meterTotal: result.meterTotal,
                transTotal: result.transTotal,
                difference: result.difference,
                severity: result.severity || 'WARNING'
            }
        });
    }

    return { success: true, result, saved: true };
}

/**
 * ตรวจสอบ anomaly ย้อนหลังหลายวัน
 * @param stationId Station ID  
 * @param days จำนวนวันย้อนหลัง
 */
export async function scanHistoricalAnomalies(
    stationId: string,
    days: number = 30
): Promise<{ scanned: number; found: number }> {
    let found = 0;

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const { result, saved } = await checkAndSaveDailyAnomaly(stationId, date);
        if (result.hasAnomaly) {
            found++;
            console.log(`[DailyAnomaly] ${date.toISOString().split('T')[0]}: diff=${result.difference.toFixed(2)}L (${result.severity})`);
        }
    }

    return { scanned: days, found };
}

/**
 * ดึงรายการ daily anomaly ที่ยังไม่ได้ตรวจสอบ
 */
export async function getPendingDailyAnomalies(stationId?: string) {
    return prisma.dailyAnomaly.findMany({
        where: {
            reviewedAt: null,
            ...(stationId && { stationId })
        },
        include: {
            station: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        take: 50
    });
}

/**
 * ทำเครื่องหมาย daily anomaly ว่าตรวจสอบแล้ว
 */
export async function markDailyAnomalyReviewed(
    anomalyId: string,
    reviewedById: string,
    note?: string
): Promise<void> {
    await prisma.dailyAnomaly.update({
        where: { id: anomalyId },
        data: {
            reviewedById,
            reviewedAt: new Date(),
            note
        }
    });
}
