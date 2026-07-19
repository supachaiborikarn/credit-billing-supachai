import { NOZZLE_COUNT, STATIONS } from '@/constants';
import { buildEpsonAssistantDailyReportXml, type PrintableDailyMeter, type PrintableDailyTransaction } from '@/lib/daily-report-print';
import { formatDateBangkok, getEndOfDayBangkok, getStartOfDayBangkok } from '@/lib/date-utils';
import { buildFullStationDailyMeters } from '@/lib/full-station-shift-scope';
import { prisma } from '@/lib/prisma';

const TANK_LOY_STATION_ID = 'station-1';
const TANK_LOY_STATION_NAME = STATIONS.find(station => station.id === TANK_LOY_STATION_ID)?.name || 'แท๊งลอยวัชรเกียรติ';

type NumericValue = number | string | { toString(): string } | null | undefined;

type DailyRecordForAutoPrint = {
    meters: Array<{
        nozzleNumber: number;
        startReading: NumericValue;
        endReading: NumericValue;
        startPhoto?: string | null;
        endPhoto?: string | null;
        shiftId?: string | null;
    }>;
    shifts: Array<{
        id: string;
        shiftNumber: number;
        status: string;
        createdAt: Date;
        meters: Array<{
            nozzleNumber: number;
            startReading: NumericValue;
            endReading: NumericValue;
            startPhoto?: string | null;
            endPhoto?: string | null;
        }>;
        _count: { transactions: number };
    }>;
};

export type TankLoyAutoPrintResponse = {
    ready: boolean;
    jobId: string;
    stationId: typeof TANK_LOY_STATION_ID;
    stationName: string;
    reportDate: string;
    paperSize: '80';
    reasons: string[];
    transactionCount: number;
    meterCount: number;
    xml: string | null;
};

export function getPreviousBangkokDate(now = new Date()): string {
    const today = getTodayBangkokAt(now);
    const [year, month, day] = today.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 1, day - 1));
    return previous.toISOString().slice(0, 10);
}

function getTodayBangkokAt(now: Date): string {
    return formatDateBangkok(now);
}

export function validateAutoPrintDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const parsed = getStartOfDayBangkok(date);
    return !Number.isNaN(parsed.getTime()) && formatDateBangkok(parsed) === date;
}

export function assessTankLoyAutoPrintReadiness(meters: PrintableDailyMeter[]): string[] {
    const reasons: string[] = [];
    const metersByNozzle = new Map(meters.map(meter => [meter.nozzleNumber, meter]));
    const missingStart: number[] = [];
    const missingEnd: number[] = [];

    for (let nozzleNumber = 1; nozzleNumber <= NOZZLE_COUNT; nozzleNumber += 1) {
        const meter = metersByNozzle.get(nozzleNumber);
        if (!meter || Number(meter.startReading) <= 0) missingStart.push(nozzleNumber);
        if (!meter || meter.endReading == null || Number(meter.endReading) <= 0) missingEnd.push(nozzleNumber);
    }

    if (missingStart.length > 0) {
        reasons.push(`ยังไม่มีเลขเปิดมิเตอร์หัว ${missingStart.join(', ')}`);
    }

    if (missingEnd.length > 0) {
        reasons.push(`ยังไม่มีเลขปิดมิเตอร์หัว ${missingEnd.join(', ')}`);
    }

    return reasons;
}

export function buildTankLoyAutoPrintResponse({
    reportDate,
    dailyRecord,
    transactions,
}: {
    reportDate: string;
    dailyRecord: DailyRecordForAutoPrint | null;
    transactions: PrintableDailyTransaction[];
}): TankLoyAutoPrintResponse {
    const jobId = `${TANK_LOY_STATION_ID}:${reportDate}`;

    if (!dailyRecord) {
        return {
            ready: false,
            jobId,
            stationId: TANK_LOY_STATION_ID,
            stationName: TANK_LOY_STATION_NAME,
            reportDate,
            paperSize: '80',
            reasons: [`ยังไม่พบข้อมูลของวันที่ ${reportDate}`],
            transactionCount: transactions.length,
            meterCount: 0,
            xml: null,
        };
    }

    const dailyMeters = buildFullStationDailyMeters(
        dailyRecord.shifts,
        dailyRecord.meters.filter(meter => !meter.shiftId)
    ).map(meter => ({
        nozzleNumber: meter.nozzleNumber,
        startReading: Number(meter.startReading || 0),
        endReading: meter.endReading == null ? null : Number(meter.endReading),
        liters: meter.endReading == null
            ? 0
            : Math.max(Number(meter.endReading) - Number(meter.startReading || 0), 0),
    }));
    const reasons = assessTankLoyAutoPrintReadiness(dailyMeters);
    const ready = reasons.length === 0;

    return {
        ready,
        jobId,
        stationId: TANK_LOY_STATION_ID,
        stationName: TANK_LOY_STATION_NAME,
        reportDate,
        paperSize: '80',
        reasons,
        transactionCount: transactions.length,
        meterCount: dailyMeters.length,
        xml: ready
            ? buildEpsonAssistantDailyReportXml({
                stationName: TANK_LOY_STATION_NAME,
                reportDate,
                transactions,
                meters: dailyMeters,
                paperSize: '80',
            })
            : null,
    };
}

export async function loadTankLoyAutoPrintReport(
    reportDate = getPreviousBangkokDate()
): Promise<TankLoyAutoPrintResponse> {
    const date = getStartOfDayBangkok(reportDate);
    const [dailyRecord, rows] = await Promise.all([
        prisma.dailyRecord.findUnique({
            where: {
                stationId_date: {
                    stationId: TANK_LOY_STATION_ID,
                    date,
                },
            },
            include: {
                meters: true,
                shifts: {
                    include: {
                        meters: true,
                        _count: { select: { transactions: true } },
                    },
                },
            },
        }),
        prisma.transaction.findMany({
            where: {
                stationId: TANK_LOY_STATION_ID,
                date: {
                    gte: getStartOfDayBangkok(reportDate),
                    lte: getEndOfDayBangkok(reportDate),
                },
                deletedAt: null,
                isVoided: false,
            },
            orderBy: { date: 'asc' },
            include: {
                owner: { select: { name: true } },
                truck: { select: { licensePlate: true } },
                recordedBy: { select: { name: true } },
            },
        }),
    ]);

    const transactions: PrintableDailyTransaction[] = rows.map(row => ({
        id: row.id,
        date: row.date.toISOString(),
        licensePlate: row.licensePlate || row.truck?.licensePlate || '',
        ownerName: row.owner?.name || row.ownerName || '',
        paymentType: row.paymentType,
        fuelType: row.productType || null,
        liters: Number(row.liters),
        amount: Number(row.amount),
        billBookNo: row.billBookNo || null,
        billNo: row.billNo || null,
        recordedByName: row.recordedBy?.name || '-',
    }));

    return buildTankLoyAutoPrintResponse({
        reportDate,
        dailyRecord,
        transactions,
    });
}
