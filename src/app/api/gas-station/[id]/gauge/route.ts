import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEndOfDayBangkokUTC, getStartOfDayBangkokUTC, getTodayBangkok } from '@/lib/gas/date-utils';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

function isStrictDateKey(value: string): boolean {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

// GET — legacy read compatibility only. Must remain side-effect free.
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateKey = (searchParams.get('date') || getTodayBangkok()).trim();
        if (!isStrictDateKey(dateKey)) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const shiftRaw = searchParams.get('shift');
        const shiftNumber = shiftRaw === null ? 0 : Number(shiftRaw);
        if (!Number.isInteger(shiftNumber) || shiftNumber < 0 || shiftNumber > 2) {
            return NextResponse.json({ error: 'กะต้องเป็น 0, 1 หรือ 2' }, { status: 400 });
        }

        const stationId = auth.station.dbId;
        const startOfDay = getStartOfDayBangkokUTC(dateKey);
        const endOfDay = getEndOfDayBangkokUTC(dateKey);
        const baseWhere = {
            stationId,
            date: { gte: startOfDay, lte: endOfDay },
        };

        let gaugeReadings = await prisma.gaugeReading.findMany({
            where: shiftNumber > 0 ? { ...baseWhere, shiftNumber } : baseWhere,
            orderBy: { createdAt: 'desc' },
        });

        // Historical compatibility: old readings were stored with shiftNumber=0.
        if (gaugeReadings.length === 0 && shiftNumber > 0) {
            gaugeReadings = await prisma.gaugeReading.findMany({
                where: { ...baseWhere, shiftNumber: 0 },
                orderBy: { createdAt: 'desc' },
            });
        }

        const readingsByTank: Record<number, { start?: typeof gaugeReadings[number]; end?: typeof gaugeReadings[number] }> = {};
        for (const reading of gaugeReadings) {
            if (!readingsByTank[reading.tankNumber]) readingsByTank[reading.tankNumber] = {};
            const type = reading.notes === 'start' ? 'start' : reading.notes === 'end' ? 'end' : null;
            if (type && !readingsByTank[reading.tankNumber][type]) {
                readingsByTank[reading.tankNumber][type] = reading;
            }
        }

        return NextResponse.json([1, 2, 3].map((tankNumber) => {
            const readings = readingsByTank[tankNumber];
            return {
                tankNumber,
                startPercentage: readings?.start ? Number(readings.start.percentage) : null,
                endPercentage: readings?.end ? Number(readings.end.percentage) : null,
                startPhoto: readings?.start?.photoUrl || null,
                endPhoto: readings?.end?.photoUrl || null,
            };
        }));
    } catch (error) {
        console.error('Gauge reading GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}

// POST — retired. Canonical GAS Operations owns gauge writes.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    const { id } = await params;
    const auth = await requireGasStationAccess(id);
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'legacy GAS gauge write API retired',
        canonicalOperations: `/stations/station-${auth.station.index}/operations`,
        canonicalGaugeApi: `/api/v2/gas/${auth.station.index}/gauge`,
    }, { status: 410 });
}
