import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    formatThaiDate,
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    isValidDateKey,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';

function subtractBangkokDays(dateKey: string, days: number): string {
    const date = getStartOfDayBangkokUTC(dateKey);
    date.setUTCDate(date.getUTCDate() - days);
    return toBangkokDateKey(date);
}

function resolveGasStationFilter(value: string | null): string[] | null {
    const gasStations = STATIONS.filter((station) => station.type === 'GAS');
    if (!value || value === 'all') return gasStations.map((station) => station.id);
    return gasStations.some((station) => station.id === value) ? [value] : null;
}

function resolveTankFilter(value: string | null): number | null | 'invalid' {
    if (!value || value === 'all') return null;
    if (!/^[1-3]$/.test(value)) return 'invalid';
    return Number(value);
}

/** GET /api/v2/gas/admin/gauge — read-only GAS gauge history. */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const todayKey = getGasBusinessDateKey();
        const fromKey = searchParams.get('from') || subtractBangkokDays(todayKey, 7);
        const toKey = searchParams.get('to') || todayKey;

        if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const fromDate = getStartOfDayBangkokUTC(fromKey);
        const toDate = getEndOfDayBangkokUTC(toKey);
        if (fromDate > toDate) {
            return NextResponse.json({ error: 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด' }, { status: 400 });
        }

        const stationIds = resolveGasStationFilter(searchParams.get('stationId'));
        if (!stationIds) {
            return NextResponse.json({ error: 'Invalid gas station' }, { status: 400 });
        }

        const tankNumber = resolveTankFilter(searchParams.get('tank'));
        if (tankNumber === 'invalid') {
            return NextResponse.json({ error: 'tank must be 1, 2 or 3' }, { status: 400 });
        }

        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: fromDate, lte: toDate },
                ...(tankNumber !== null ? { tankNumber } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        const stationsMap = new Map<string, string>(STATIONS.map((station) => [station.id, station.name]));
        const readings = gaugeReadings.map((reading) => ({
            id: reading.id,
            date: toBangkokDateKey(reading.date),
            displayDate: formatThaiDate(reading.date),
            stationId: reading.stationId,
            stationName: stationsMap.get(reading.stationId) || 'Unknown',
            shiftNumber: reading.shiftNumber,
            tankNumber: reading.tankNumber,
            percentage: Number(reading.percentage),
            notes: reading.notes,
            createdAt: reading.createdAt.toISOString(),
        }));

        return NextResponse.json({
            readings,
            filters: { from: fromKey, to: toKey },
        });
    } catch (error) {
        console.error('[Gauge History]:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}
