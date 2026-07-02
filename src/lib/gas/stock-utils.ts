/**
 * Gas stock utilities (server-only)
 * - คาดการณ์สต็อกคงเหลือ/วันหมดจากเกจล่าสุด + อัตราขายเฉลี่ย
 * - ตรวจสอบปริมาณรับจริงจากเดลต้าเกจ (ก่อน-หลังวันลงแก๊ส) เทียบใบส่ง
 */
import { prisma } from '@/lib/prisma';
import { TANK_CAPACITY, TANK_COUNT } from './gauge-utils';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from './date-utils';

const AVG_WINDOW_DAYS = 7;
const LOW_STOCK_DAYS_THRESHOLD = 3;
const GAUGE_DIFF_WARN_PERCENT = 5;

function round1(value: number): number {
    return Number(value.toFixed(1));
}

function percentToLiters(percentage: number): number {
    return (percentage / 100) * TANK_CAPACITY;
}

function metersToLiters(meters: { soldQty: unknown; startReading: unknown; endReading: unknown }[]): number {
    return meters.reduce((sum, meter) => {
        const sold = meter.soldQty !== null && meter.soldQty !== undefined
            ? Number(meter.soldQty)
            : Math.max(Number(meter.endReading ?? 0) - Number(meter.startReading ?? 0), 0);
        return sum + (Number.isFinite(sold) ? sold : 0);
    }, 0);
}

export interface StationStockForecast {
    stationId: string;
    currentStockLiters: number | null;
    capacityLiters: number;
    latestGaugeDateKey: string | null;
    avgDailySoldLiters: number | null;
    daysLeft: number | null;
    projectedEmptyDateKey: string | null;
    stockAlertLiters: number | null;
    lowStock: boolean;
}

/**
 * คาดการณ์สต็อกจากเกจล่าสุด + ค่าเฉลี่ยขายจากมิเตอร์ 7 วันหลังสุด
 */
export async function buildStationStockForecast(stationId: string): Promise<StationStockForecast> {
    const [latestGauges, recentRecords, station] = await Promise.all([
        prisma.gaugeReading.findMany({
            where: { stationId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: TANK_COUNT * 6,
            select: { tankNumber: true, percentage: true, date: true },
        }),
        prisma.dailyRecord.findMany({
            where: { stationId },
            orderBy: { date: 'desc' },
            take: AVG_WINDOW_DAYS,
            select: {
                date: true,
                meters: { select: { soldQty: true, startReading: true, endReading: true } },
            },
        }),
        prisma.station.findUnique({
            where: { id: stationId },
            select: { gasStockAlert: true },
        }),
    ]);

    // เกจล่าสุดของแต่ละถัง (อ่านรายการใหม่สุดก่อน เก็บถังละ 1 ค่า)
    const latestByTank = new Map<number, { percentage: number; date: Date }>();
    for (const reading of latestGauges) {
        if (!latestByTank.has(reading.tankNumber)) {
            latestByTank.set(reading.tankNumber, {
                percentage: Number(reading.percentage),
                date: reading.date,
            });
        }
        if (latestByTank.size >= TANK_COUNT) break;
    }

    let currentStockLiters: number | null = null;
    let latestGaugeDateKey: string | null = null;
    if (latestByTank.size > 0) {
        let liters = 0;
        let newest: Date | null = null;
        for (const { percentage, date } of latestByTank.values()) {
            liters += percentToLiters(percentage);
            if (!newest || date > newest) newest = date;
        }
        currentStockLiters = round1(liters);
        latestGaugeDateKey = newest ? toBangkokDateKey(newest) : null;
    }

    // ค่าเฉลี่ยลิตรขายต่อวัน (เฉพาะวันที่มีข้อมูลมิเตอร์)
    const dailyLiters = recentRecords
        .map((record) => metersToLiters(record.meters))
        .filter((liters) => liters > 0);
    const avgDailySoldLiters = dailyLiters.length > 0
        ? round1(dailyLiters.reduce((sum, liters) => sum + liters, 0) / dailyLiters.length)
        : null;

    let daysLeft: number | null = null;
    let projectedEmptyDateKey: string | null = null;
    if (currentStockLiters !== null && avgDailySoldLiters !== null && avgDailySoldLiters > 0) {
        daysLeft = round1(currentStockLiters / avgDailySoldLiters);
        projectedEmptyDateKey = toBangkokDateKey(
            new Date(Date.now() + Math.floor(daysLeft) * 24 * 60 * 60 * 1000)
        );
    }

    const stockAlertLiters = station?.gasStockAlert !== null && station?.gasStockAlert !== undefined
        ? Number(station.gasStockAlert)
        : null;
    const lowStock = (
        currentStockLiters !== null
        && stockAlertLiters !== null
        && currentStockLiters <= stockAlertLiters
    ) || (daysLeft !== null && daysLeft <= LOW_STOCK_DAYS_THRESHOLD);

    return {
        stationId,
        currentStockLiters,
        capacityLiters: TANK_COUNT * TANK_CAPACITY,
        latestGaugeDateKey,
        avgDailySoldLiters,
        daysLeft,
        projectedEmptyDateKey,
        stockAlertLiters,
        lowStock,
    };
}

export interface SupplyGaugeCheck {
    dateKey: string;
    stationId: string;
    startLiters: number | null;
    endLiters: number | null;
    soldLiters: number;
    /** ปริมาณรับจริงโดยประมาณ = (เกจปิดวัน - เกจเปิดวัน) + ลิตรที่ขายในวัน */
    estimatedReceivedLiters: number | null;
    /** รวมลิตรตามใบส่งของวันนั้น (อาจมีหลายใบ) */
    invoiceLitersSameDay: number;
    supplyCountSameDay: number;
    diffLiters: number | null;
    diffPercent: number | null;
    status: 'OK' | 'WARN' | 'NO_GAUGE';
}

/**
 * ตรวจปริมาณรับจริงจากเกจ รายวัน: received ≈ Δเกจ + ขายในวัน
 * คืน Map key = `${stationId}:${dateKey}`
 */
export async function buildSupplyGaugeChecks(
    supplies: { stationId: string; date: string; liters: number }[]
): Promise<Map<string, SupplyGaugeCheck>> {
    const result = new Map<string, SupplyGaugeCheck>();
    if (supplies.length === 0) return result;

    // รวมใบส่งเป็นรายวันต่อสถานี
    const dayTotals = new Map<string, { stationId: string; dateKey: string; liters: number; count: number }>();
    for (const supply of supplies) {
        const dateKey = toBangkokDateKey(supply.date);
        const key = `${supply.stationId}:${dateKey}`;
        const current = dayTotals.get(key) ?? {
            stationId: supply.stationId,
            dateKey,
            liters: 0,
            count: 0,
        };
        current.liters += supply.liters;
        current.count += 1;
        dayTotals.set(key, current);
    }

    const stationIds = Array.from(new Set(supplies.map((s) => s.stationId)));
    const dateKeys = Array.from(new Set(Array.from(dayTotals.values()).map((d) => d.dateKey))).sort();
    const rangeStart = getStartOfDayBangkokUTC(dateKeys[0]);
    const rangeEnd = getEndOfDayBangkokUTC(dateKeys[dateKeys.length - 1]);

    const [gaugeReadings, dailyRecords] = await Promise.all([
        prisma.gaugeReading.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: rangeStart, lte: rangeEnd },
                notes: { in: ['start', 'end'] },
            },
            orderBy: [{ shiftNumber: 'asc' }, { createdAt: 'asc' }],
            select: {
                stationId: true,
                date: true,
                tankNumber: true,
                percentage: true,
                notes: true,
                shiftNumber: true,
            },
        }),
        prisma.dailyRecord.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: rangeStart, lte: rangeEnd },
            },
            select: {
                stationId: true,
                date: true,
                meters: { select: { soldQty: true, startReading: true, endReading: true } },
            },
        }),
    ]);

    // จัดกลุ่มเกจ: เปิดวัน = 'start' กะแรกสุดของถัง / ปิดวัน = 'end' กะท้ายสุดของถัง
    type TankMap = Map<number, number>; // tankNumber -> percentage
    const startByDay = new Map<string, TankMap>();
    const endByDay = new Map<string, TankMap>();
    for (const reading of gaugeReadings) {
        const key = `${reading.stationId}:${toBangkokDateKey(reading.date)}`;
        const percentage = Number(reading.percentage);
        if (reading.notes === 'start') {
            const tanks = startByDay.get(key) ?? new Map<number, number>();
            // เรียง asc อยู่แล้ว — เก็บเฉพาะค่าแรก (กะแรก) ของถัง
            if (!tanks.has(reading.tankNumber)) tanks.set(reading.tankNumber, percentage);
            startByDay.set(key, tanks);
        } else {
            const tanks = endByDay.get(key) ?? new Map<number, number>();
            // เขียนทับเรื่อยๆ จนเหลือค่าท้ายสุด (กะสุดท้าย) ของถัง
            tanks.set(reading.tankNumber, percentage);
            endByDay.set(key, tanks);
        }
    }

    const soldByDay = new Map<string, number>();
    for (const record of dailyRecords) {
        const key = `${record.stationId}:${toBangkokDateKey(record.date)}`;
        soldByDay.set(key, (soldByDay.get(key) ?? 0) + metersToLiters(record.meters));
    }

    for (const [key, day] of dayTotals.entries()) {
        const startTanks = startByDay.get(key);
        const endTanks = endByDay.get(key);
        const soldLiters = round1(soldByDay.get(key) ?? 0);

        const hasCompleteGauge = Boolean(
            startTanks && endTanks
            && startTanks.size >= TANK_COUNT
            && endTanks.size >= TANK_COUNT
        );

        let startLiters: number | null = null;
        let endLiters: number | null = null;
        let estimatedReceivedLiters: number | null = null;
        let diffLiters: number | null = null;
        let diffPercent: number | null = null;
        let status: SupplyGaugeCheck['status'] = 'NO_GAUGE';

        if (hasCompleteGauge && startTanks && endTanks) {
            startLiters = round1(
                Array.from(startTanks.values()).reduce((sum, p) => sum + percentToLiters(p), 0)
            );
            endLiters = round1(
                Array.from(endTanks.values()).reduce((sum, p) => sum + percentToLiters(p), 0)
            );
            estimatedReceivedLiters = round1((endLiters - startLiters) + soldLiters);
            diffLiters = round1(estimatedReceivedLiters - day.liters);
            diffPercent = day.liters > 0 ? round1((diffLiters / day.liters) * 100) : null;
            status = diffPercent !== null && Math.abs(diffPercent) <= GAUGE_DIFF_WARN_PERCENT
                ? 'OK'
                : 'WARN';
        }

        result.set(key, {
            dateKey: day.dateKey,
            stationId: day.stationId,
            startLiters,
            endLiters,
            soldLiters,
            estimatedReceivedLiters,
            invoiceLitersSameDay: round1(day.liters),
            supplyCountSameDay: day.count,
            diffLiters,
            diffPercent,
            status,
        });
    }

    return result;
}
