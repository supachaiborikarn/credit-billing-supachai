/**
 * Daily Anomaly Detection Service
 * 
 * ตรวจจับความผิดปกติของยอดขายรายวัน (สำหรับ stations ที่ไม่ใช้ระบบกะ)
 * - เปรียบเทียบยอดรวม transactions กับยอดรวม meterReading
 * - บันทึก anomaly ถ้าผลต่างเกิน threshold
 */

import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, formatDateBangkok } from '@/lib/date-utils';
import { getWatcharaExternalDailySummary } from '@/lib/operational-sales';
import { buildFullStationDailyMeters } from '@/lib/full-station-shift-scope';

const WARNING_THRESHOLD = 10;   // ผลต่าง 10 ลิตร = WARNING
const CRITICAL_THRESHOLD = 50;  // ผลต่าง 50 ลิตร = CRITICAL

export interface DailyAnomalyResult {
    hasAnomaly: boolean;
    meterTotal: number;
    transTotal: number;
    difference: number;
    externalLiters: number;
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
    // Convert date to Bangkok timezone string and get proper UTC ranges
    const dateStr = formatDateBangkok(date);
    const startOfDay = getStartOfDayBangkok(dateStr);
    const endOfDay = getEndOfDayBangkok(dateStr);


    // Get meter total for the day from one DailyRecord so FULL split shifts can
    // use the first opening and final closing per nozzle.
    const dailyRecord = await prisma.dailyRecord.findUnique({
        where: {
            stationId_date: { stationId, date: startOfDay },
        },
        include: {
            station: { select: { type: true } },
            meters: true,
            shifts: { include: { meters: true } },
        },
    });
    const meterReadings = dailyRecord?.station.type === 'FULL'
        ? buildFullStationDailyMeters(
            dailyRecord.shifts,
            dailyRecord.meters.filter(meter => !meter.shiftId)
        )
        : dailyRecord?.meters || [];

    // Calculate meter total - use soldQty if available, otherwise calculate from readings
    const meterTotal = meterReadings.reduce((sum, r) => {
        if ('soldQty' in r && r.soldQty !== null && r.soldQty !== undefined) {
            return sum + Number(r.soldQty);
        }

        const startReading = Number(r.startReading || 0);
        const endReading = r.endReading == null ? null : Number(r.endReading);
        if (startReading > 0 && endReading != null && endReading >= startReading) {
            return sum + (endReading - startReading);
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
            isVoided: { not: true },
            deletedAt: null,
        },
        select: { liters: true }
    });

    const internalTransTotal = transactions.reduce((sum, t) => sum + Number(t.liters || 0), 0);
    const externalSummary = await getWatcharaExternalDailySummary({ stationId, dateKey: dateStr });
    const externalLiters = externalSummary.summary.liters;
    const adjustedMeterTotal = meterTotal + externalLiters;
    const transTotal = internalTransTotal + externalLiters;

    // Calculate difference
    const difference = transTotal - adjustedMeterTotal;
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
        meterTotal: adjustedMeterTotal,
        transTotal,
        difference,
        externalLiters,
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

    // Get date only for database lookup (using Bangkok timezone)
    const dateStr = formatDateBangkok(date);
    const dateOnly = getStartOfDayBangkok(dateStr);

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
            // Deleted resolved anomaly record
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

        const { result } = await checkAndSaveDailyAnomaly(stationId, date);
        if (result.hasAnomaly) {
            found++;
            // Anomaly detected - logged for review
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
