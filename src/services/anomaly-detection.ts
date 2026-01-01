/**
 * Anomaly Detection Service
 * 
 * ตรวจจับความผิดปกติของยอดขายมิเตอร์
 * - คำนวณค่าเฉลี่ยย้อนหลัง 7-30 วัน
 * - ตรวจสอบและบันทึก anomaly
 * - แจ้งเตือนก่อนปิดกะ
 */

import { prisma } from '@/lib/prisma';
import { detectMeterAnomaly } from './meter-service';

export interface AnomalyCheckResult {
    hasAnomalies: boolean;
    anomalies: Array<{
        nozzleNumber: number;
        soldQty: number;
        averageQty: number;
        percentDiff: number;
        severity: 'WARNING' | 'CRITICAL';
        message: string;
    }>;
    requiresNote: boolean;
}

const WARNING_THRESHOLD = 50;  // 50% ต่างจากค่าเฉลี่ย = WARNING
const CRITICAL_THRESHOLD = 100; // 100% ต่างจากค่าเฉลี่ย = CRITICAL

/**
 * คำนวณค่าเฉลี่ยยอดขายต่อกะของแต่ละหัวจ่าย
 * @param stationId Station ID
 * @param nozzleNumber หมายเลขหัวจ่าย
 * @param days จำนวนวันย้อนหลัง (default: 7)
 */
export async function getAverageSoldQty(
    stationId: string,
    nozzleNumber: number,
    days: number = 7
): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await prisma.meterReading.findMany({
        where: {
            nozzleNumber,
            soldQty: { not: null },
            shift: {
                dailyRecord: { stationId },
                status: { in: ['CLOSED', 'LOCKED'] },
                createdAt: { gte: startDate }
            }
        },
        select: { soldQty: true }
    });

    if (readings.length === 0) {
        return 0;
    }

    const totalSold = readings.reduce((sum, r) => sum + Number(r.soldQty || 0), 0);
    return totalSold / readings.length;
}

/**
 * ตรวจสอบ anomaly ทั้งหมดของกะ
 * @param shiftId Shift ID ที่จะตรวจสอบ
 */
export async function checkShiftAnomalies(shiftId: string): Promise<AnomalyCheckResult> {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            meters: true,
            dailyRecord: { select: { stationId: true } }
        }
    });

    if (!shift) {
        return { hasAnomalies: false, anomalies: [], requiresNote: false };
    }

    const anomalies: AnomalyCheckResult['anomalies'] = [];

    for (const meter of shift.meters) {
        const soldQty = Number(meter.soldQty || 0);
        if (soldQty <= 0) continue;

        const averageQty = await getAverageSoldQty(
            shift.dailyRecord.stationId,
            meter.nozzleNumber,
            7
        );

        if (averageQty === 0) continue;

        const result = detectMeterAnomaly(soldQty, averageQty, WARNING_THRESHOLD);

        if (result.isAnomaly && result.percentDiff !== undefined) {
            const severity = Math.abs(result.percentDiff) >= CRITICAL_THRESHOLD
                ? 'CRITICAL'
                : 'WARNING';

            anomalies.push({
                nozzleNumber: meter.nozzleNumber,
                soldQty,
                averageQty,
                percentDiff: result.percentDiff,
                severity,
                message: result.message || `ยอดผิดปกติ ${result.percentDiff.toFixed(0)}%`
            });
        }
    }

    return {
        hasAnomalies: anomalies.length > 0,
        anomalies,
        requiresNote: anomalies.some(a => a.severity === 'CRITICAL')
    };
}

/**
 * บันทึก anomaly ลงฐานข้อมูล
 * @param shiftId Shift ID
 * @param anomalies รายการ anomaly ที่พบ
 * @param note หมายเหตุจากพนักงาน
 */
export async function saveAnomalies(
    shiftId: string,
    anomalies: AnomalyCheckResult['anomalies'],
    note?: string
): Promise<void> {
    await prisma.meterAnomaly.createMany({
        data: anomalies.map(a => ({
            shiftId,
            nozzleNumber: a.nozzleNumber,
            soldQty: a.soldQty,
            averageQty: a.averageQty,
            percentDiff: a.percentDiff,
            severity: a.severity,
            note
        }))
    });
}

/**
 * ตรวจสอบและบันทึก anomaly พร้อมกัน
 * @param shiftId Shift ID
 * @param note หมายเหตุ (required ถ้ามี CRITICAL)
 */
export async function checkAndSaveAnomalies(
    shiftId: string,
    note?: string
): Promise<{ success: boolean; result: AnomalyCheckResult; error?: string }> {
    const result = await checkShiftAnomalies(shiftId);

    if (result.requiresNote && !note) {
        return {
            success: false,
            result,
            error: 'พบความผิดปกติรุนแรง กรุณาระบุเหตุผล'
        };
    }

    if (result.hasAnomalies) {
        await saveAnomalies(shiftId, result.anomalies, note);
    }

    return { success: true, result };
}

/**
 * ดึงรายการ anomaly ที่ยังไม่ได้ตรวจสอบ
 */
export async function getPendingAnomalies(stationId?: string) {
    return prisma.meterAnomaly.findMany({
        where: {
            reviewedAt: null,
            ...(stationId && {
                shift: { dailyRecord: { stationId } }
            })
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}

/**
 * ทำเครื่องหมายว่าตรวจสอบแล้ว
 */
export async function markAnomalyReviewed(
    anomalyId: string,
    reviewedById: string
): Promise<void> {
    await prisma.meterAnomaly.update({
        where: { id: anomalyId },
        data: {
            reviewedById,
            reviewedAt: new Date()
        }
    });
}
