import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/api-auth';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { selectCanonicalFullStationShift } from '@/lib/full-station-shift-scope';
import { findLatestPriorOpenFullShift } from '@/lib/full-station-stale-shift';
import {
    getEndOfDayBangkokUTC,
    getGasActiveShiftDateRange,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas';
import { resolveDailyGasPrice } from '@/lib/gas/v2-workflow';
import { prisma } from '@/lib/prisma';
import {
    buildFullOpeningMeterEvidence,
    buildStationPermissions,
    getCanonicalStationPaths,
    resolveStationDefinition,
    type StationDefinition,
} from '@/lib/stations/station-context';
import type {
    StationContextPayload,
    StationCurrentShift,
    StationOpeningState,
} from '@/types/station';

const EMPTY_OPENING_STATE: StationOpeningState = {
    status: 'NO_SHIFT',
    requiredMeters: 0,
    completedMeters: 0,
    requiredGauges: 0,
    completedGauges: 0,
    requiresMeterPhotos: false,
    nextShiftNumber: null,
    fullMeters: [],
};

async function getFullCurrentShift(stationId: string): Promise<StationCurrentShift | null> {
    const dateKey = getTodayBangkok();
    const start = getStartOfDayBangkok(dateKey);
    const end = getEndOfDayBangkok(dateKey);
    const dailyRecord = await prisma.dailyRecord.findFirst({
        where: { stationId, date: { gte: start, lte: end } },
        include: {
            shifts: {
                orderBy: [{ shiftNumber: 'asc' }, { createdAt: 'asc' }],
                include: {
                    staff: { select: { name: true } },
                    meters: true,
                    _count: { select: { transactions: true } },
                },
            },
        },
    });

    if (!dailyRecord) return null;
    const shift = selectCanonicalFullStationShift(dailyRecord.shifts);
    if (!shift) return null;

    return {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        status: shift.status,
        businessDate: dateKey,
        openedAt: shift.createdAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() || null,
        staffName: shift.staff?.name || null,
    };
}

async function getGasCurrentShift(stationId: string): Promise<StationCurrentShift | null> {
    const dateKey = getGasBusinessDateKey();
    const activeRange = getGasActiveShiftDateRange(dateKey);
    const shift = await prisma.shift.findFirst({
        where: {
            status: 'OPEN',
            dailyRecord: {
                stationId,
                date: { gte: activeRange.start, lte: activeRange.end },
            },
        },
        orderBy: [{ dailyRecord: { date: 'desc' } }, { createdAt: 'desc' }],
        include: {
            dailyRecord: { select: { date: true } },
            staff: { select: { name: true } },
        },
    });

    if (!shift) return null;
    return {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        status: shift.status,
        businessDate: toBangkokDateKey(shift.dailyRecord.date),
        openedAt: shift.createdAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() || null,
        staffName: shift.staff?.name || null,
    };
}

async function getGasStaleShift(
    stationId: string,
    currentShift: StationCurrentShift | null
): Promise<StationContextPayload['staleShift']> {
    const cutoff = getStartOfDayBangkokUTC(getGasBusinessDateKey());
    const shift = await prisma.shift.findFirst({
        where: {
            status: 'OPEN',
            dailyRecord: {
                stationId,
                date: { lt: cutoff },
            },
        },
        orderBy: { createdAt: 'asc' },
        include: {
            dailyRecord: { select: { date: true } },
            staff: { select: { name: true } },
        },
    });

    if (!shift || shift.id === currentShift?.id) return null;
    return {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        status: 'OPEN',
        businessDate: toBangkokDateKey(shift.dailyRecord.date),
        openedAt: shift.createdAt.toISOString(),
        closedAt: null,
        staffName: shift.staff?.name || null,
    };
}

async function getFullOpeningState(currentShift: StationCurrentShift | null): Promise<StationOpeningState> {
    if (!currentShift || currentShift.status !== 'OPEN') {
        return {
            ...EMPTY_OPENING_STATE,
            requiredMeters: 4,
            requiresMeterPhotos: true,
        };
    }

    const meters = await prisma.meterReading.findMany({
        where: { shiftId: currentShift.id, nozzleNumber: { in: [1, 2, 3, 4] } },
        select: { nozzleNumber: true, startReading: true, startPhoto: true },
    });
    const fullMeters = buildFullOpeningMeterEvidence(meters);
    const completedMeters = fullMeters.filter((meter) => Boolean(meter.startPhoto)).length;

    return {
        status: completedMeters === 4 ? 'READY' : 'NEEDS_OPENING_DATA',
        requiredMeters: 4,
        completedMeters,
        requiredGauges: 0,
        completedGauges: 0,
        requiresMeterPhotos: true,
        nextShiftNumber: null,
        fullMeters,
    };
}

async function getGasOpeningState(
    stationId: string,
    currentShift: StationCurrentShift | null
): Promise<StationOpeningState> {
    const dateKey = getGasBusinessDateKey();
    const activeRange = getGasActiveShiftDateRange(dateKey);

    if (currentShift?.status === 'OPEN') {
        const shift = await prisma.shift.findUnique({
            where: { id: currentShift.id },
            select: { dailyRecordId: true, shiftNumber: true },
        });
        if (!shift) {
            return {
                ...EMPTY_OPENING_STATE,
                status: 'NEEDS_OPENING_DATA',
                requiredMeters: 4,
                requiredGauges: 3,
            };
        }

        const [meters, gauges] = await Promise.all([
            prisma.meterReading.findMany({
                where: { shiftId: currentShift.id, nozzleNumber: { in: [1, 2, 3, 4] } },
                select: { nozzleNumber: true },
            }),
            prisma.gaugeReading.findMany({
                where: {
                    dailyRecordId: shift.dailyRecordId,
                    shiftNumber: shift.shiftNumber,
                    notes: 'start',
                    tankNumber: { in: [1, 2, 3] },
                },
                select: { tankNumber: true },
            }),
        ]);
        const completedMeters = new Set(meters.map((meter) => meter.nozzleNumber)).size;
        const completedGauges = new Set(gauges.map((gauge) => gauge.tankNumber)).size;
        return {
            status: completedMeters === 4 && completedGauges === 3 ? 'READY' : 'NEEDS_OPENING_DATA',
            requiredMeters: 4,
            completedMeters,
            requiredGauges: 3,
            completedGauges,
            requiresMeterPhotos: false,
            nextShiftNumber: null,
        };
    }

    const shifts = await prisma.shift.findMany({
        where: {
            dailyRecord: {
                stationId,
                date: { gte: activeRange.start, lte: activeRange.end },
            },
        },
        select: { shiftNumber: true },
    });
    const used = new Set(shifts.map((shift) => shift.shiftNumber));
    const nextShiftNumber = !used.has(1) ? 1 : !used.has(2) ? 2 : null;

    return {
        status: nextShiftNumber ? 'NO_SHIFT' : 'DAY_COMPLETE',
        requiredMeters: 4,
        completedMeters: 0,
        requiredGauges: 3,
        completedGauges: 0,
        requiresMeterPhotos: false,
        nextShiftNumber,
    };
}

async function getOpeningState(
    station: StationDefinition,
    currentShift: StationCurrentShift | null
): Promise<StationOpeningState> {
    if (station.operationalStatus !== 'ACTIVE') return EMPTY_OPENING_STATE;
    return station.type === 'FULL'
        ? getFullOpeningState(currentShift)
        : getGasOpeningState(station.id, currentShift);
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        void request;
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { stationId } = await params;
        const station = resolveStationDefinition(stationId);
        if (!station) {
            return NextResponse.json({ error: 'ไม่พบสถานี' }, { status: 404 });
        }

        const permissions = buildStationPermissions(auth.user, station);
        if (!permissions.canView) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงสถานีนี้' }, { status: 403 });
        }

        let currentShift: StationCurrentShift | null = null;
        let staleShift: StationContextPayload['staleShift'] = null;
        let saleContext: StationContextPayload['saleContext'] = null;
        if (station.operationalStatus === 'ACTIVE') {
            currentShift = station.type === 'FULL'
                ? await getFullCurrentShift(station.id)
                : await getGasCurrentShift(station.id);

            if (station.type === 'GAS') {
                staleShift = await getGasStaleShift(station.id, currentShift);
            } else {
                staleShift = await findLatestPriorOpenFullShift(
                    station.id,
                    getStartOfDayBangkok(getTodayBangkok())
                );
            }

            if (station.type === 'FULL') {
                const businessDate = getTodayBangkok();
                const dailyRecord = await prisma.dailyRecord.findFirst({
                    where: {
                        stationId: station.id,
                        date: {
                            gte: getStartOfDayBangkok(businessDate),
                            lte: getEndOfDayBangkok(businessDate),
                        },
                    },
                    select: { retailPrice: true, wholesalePrice: true },
                });
                saleContext = {
                    businessDate,
                    retailPrice: dailyRecord ? Number(dailyRecord.retailPrice) : null,
                    wholesalePrice: dailyRecord ? Number(dailyRecord.wholesalePrice) : null,
                    gasPrice: null,
                };
            } else {
                const businessDate = getGasBusinessDateKey();
                const dailyRecord = await prisma.dailyRecord.findFirst({
                    where: {
                        stationId: station.id,
                        date: {
                            gte: getStartOfDayBangkokUTC(businessDate),
                            lte: getEndOfDayBangkokUTC(businessDate),
                        },
                    },
                    select: { gasPrice: true },
                });
                saleContext = {
                    businessDate,
                    retailPrice: null,
                    wholesalePrice: null,
                    gasPrice: await resolveDailyGasPrice(prisma, station.id, dailyRecord?.gasPrice),
                };
            }
        }

        const openingState = await getOpeningState(station, currentShift);
        const payload: StationContextPayload = {
            station,
            currentShift,
            staleShift,
            openingState,
            permissions,
            paths: getCanonicalStationPaths(station.id),
            user: {
                id: auth.user.id,
                name: auth.user.name,
                role: auth.user.role,
                stationId: auth.user.stationId,
            },
            capabilities: {
                saleFlow: station.operationalStatus === 'ACTIVE',
                shiftOperations: station.operationalStatus === 'ACTIVE',
                readOnlyHistory: station.operationalStatus === 'RETIRED',
            },
            saleContext,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[Station Context GET]:', error);
        return NextResponse.json({ error: 'โหลดข้อมูลสถานีไม่สำเร็จ' }, { status: 500 });
    }
}
