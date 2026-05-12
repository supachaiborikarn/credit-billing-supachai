import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    buildGasDailyAnalytics,
    getGasAnalyticsStationIds,
    getGasShiftAnalyticsData,
} from '@/lib/gas/admin-analytics';
import {
    getEndOfDayBangkokUTC,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    isValidDateKey,
    toBangkokDateKey,
} from '@/lib/gas/date-utils';
import { buildGasExecutivePrintReport } from '@/lib/gas/executive-report';
import { serializeGasSupply } from '@/lib/gas/supply-utils';
import { prisma } from '@/lib/prisma';

function subtractBangkokDays(dateKey: string, days: number): string {
    const date = getStartOfDayBangkokUTC(dateKey);
    date.setUTCDate(date.getUTCDate() - days);
    return toBangkokDateKey(date);
}

function resolveDateRange(from: string | null, to: string | null) {
    const todayKey = getGasBusinessDateKey();
    const fromKey = from && isValidDateKey(from)
        ? from
        : subtractBangkokDays(todayKey, 6);
    const toKey = to && isValidDateKey(to)
        ? to
        : todayKey;

    if (fromKey > toKey) {
        return { error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' };
    }

    return { fromKey, toKey };
}

const gasStations = STATIONS
    .filter((station) => station.type === 'GAS')
    .map((station) => ({
        stationId: station.id,
        stationName: station.name,
    }));

const gasStationNameById = new Map<string, string>(gasStations.map((station) => [
    station.stationId,
    station.stationName,
]));

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationIdFilter = searchParams.get('stationId');
        const dateRange = resolveDateRange(
            searchParams.get('from'),
            searchParams.get('to')
        );

        if ('error' in dateRange) {
            return NextResponse.json({ error: dateRange.error }, { status: 400 });
        }

        const selectedStations = stationIdFilter && stationIdFilter !== 'all'
            ? gasStations.filter((station) => station.stationId === stationIdFilter)
            : gasStations;

        if (selectedStations.length === 0) {
            return NextResponse.json({ error: 'ไม่พบปั๊มแก๊สที่เลือก' }, { status: 400 });
        }

        const stationIds = getGasAnalyticsStationIds(
            stationIdFilter && stationIdFilter !== 'all' ? stationIdFilter : null
        );

        const [shifts, supplyRows] = await Promise.all([
            getGasShiftAnalyticsData({
                fromDate: getStartOfDayBangkokUTC(dateRange.fromKey),
                toDate: getEndOfDayBangkokUTC(dateRange.toKey),
                stationId: stationIdFilter && stationIdFilter !== 'all' ? stationIdFilter : null,
            }),
            prisma.gasSupply.findMany({
                where: {
                    stationId: { in: stationIds },
                    date: {
                        gte: getStartOfDayBangkokUTC(dateRange.fromKey),
                        lte: getEndOfDayBangkokUTC(dateRange.toKey),
                    },
                },
                include: {
                    station: { select: { name: true } },
                },
                orderBy: [
                    { date: 'asc' },
                    { createdAt: 'asc' },
                ],
            }),
        ]);

        const supplies = supplyRows.map((row) => serializeGasSupply(
            row,
            gasStationNameById.get(row.stationId) ?? row.station?.name ?? row.stationId
        ));
        const daily = buildGasDailyAnalytics(shifts);
        const stationLabel = selectedStations.length === 1
            ? selectedStations[0].stationName
            : 'ทุกปั๊มแก๊ส';

        return NextResponse.json({
            report: buildGasExecutivePrintReport({
                from: dateRange.fromKey,
                to: dateRange.toKey,
                generatedAt: new Date(),
                stationLabel,
                stations: selectedStations,
                shifts,
                daily,
                supplies,
            }),
        });
    } catch (error) {
        console.error('[Gas Executive Print Report]:', error);
        return NextResponse.json({ error: 'โหลดรายงานผู้บริหารไม่สำเร็จ' }, { status: 500 });
    }
}
