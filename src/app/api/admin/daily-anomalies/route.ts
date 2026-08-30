import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import { checkAndSaveDailyAnomaly } from '@/services/daily-anomaly-detection';

const FULL_STATIONS = STATIONS.filter((station) => station.type === 'FULL');
const FULL_STATION_IDS = FULL_STATIONS.map((station) => station.id);

function addDaysToDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function parseScanDays(value: unknown) {
    if (value === undefined || value === null) return { ok: true as const, days: 30 };
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 90) {
        return { ok: false as const, error: 'days must be an integer from 1 to 90' };
    }
    return { ok: true as const, days: value };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const status = searchParams.get('status') || 'pending';
        if (!['pending', 'reviewed', 'all'].includes(status)) {
            return NextResponse.json({ error: 'Invalid anomaly status' }, { status: 400 });
        }
        if (stationId && stationId !== 'all' && !FULL_STATION_IDS.includes(stationId as (typeof FULL_STATION_IDS)[number])) {
            return NextResponse.json({ error: 'Invalid FULL station' }, { status: 400 });
        }

        const anomalies = await prisma.dailyAnomaly.findMany({
            where: {
                stationId: { in: stationId && stationId !== 'all' ? [stationId] : [...FULL_STATION_IDS] },
                ...(status === 'pending' && { reviewedAt: null }),
                ...(status === 'reviewed' && { reviewedAt: { not: null } }),
            },
            include: {
                station: { select: { name: true } },
                reviewedBy: { select: { name: true } },
            },
            orderBy: { date: 'desc' },
            take: 100,
        });

        return NextResponse.json({
            anomalies: anomalies.map((item) => ({
                id: item.id,
                stationId: item.stationId,
                stationName: item.station.name,
                date: item.date.toISOString(),
                displayDate: item.date.toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok',
                }),
                meterTotal: Number(item.meterTotal),
                transTotal: Number(item.transTotal),
                difference: Number(item.difference),
                severity: item.severity,
                note: item.note,
                reviewedAt: item.reviewedAt?.toISOString() || null,
                reviewedBy: item.reviewedBy?.name || null,
            })),
        });
    } catch (error) {
        console.error('[Daily Anomalies GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const parsedDays = parseScanDays((body as { days?: unknown }).days);
        if (!parsedDays.ok) return NextResponse.json({ error: parsedDays.error }, { status: 400 });

        const todayKey = getTodayBangkok();
        let totalFound = 0;
        const results: { stationId: string; stationName: string; found: number }[] = [];

        for (const station of FULL_STATIONS) {
            let found = 0;
            for (let offset = 1; offset <= parsedDays.days; offset++) {
                const dateKey = addDaysToDateKey(todayKey, -offset);
                const { result } = await checkAndSaveDailyAnomaly(station.id, getStartOfDayBangkok(dateKey));
                if (result.hasAnomaly) found += 1;
            }
            totalFound += found;
            results.push({ stationId: station.id, stationName: station.name, found });
        }

        return NextResponse.json({
            success: true,
            scanned: FULL_STATIONS.length,
            days: parsedDays.days,
            totalFound,
            results,
        });
    } catch (error) {
        console.error('[Daily Anomalies POST]:', error);
        return NextResponse.json({ error: 'Failed to scan anomalies' }, { status: 500 });
    }
}
