import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    getTodayBangkok,
    toBangkokDateKey,
} from '@/lib/gas';

type PreviousShift = {
    id: string;
    shiftNumber: number;
    dailyRecord: { date: Date };
    meters: {
        nozzleNumber: number;
        startReading: unknown;
        endReading: unknown | null;
    }[];
};

function serializeMeters(shift: PreviousShift) {
    return Object.fromEntries(
        shift.meters.map((meter) => [
            String(meter.nozzleNumber),
            Number(meter.endReading ?? meter.startReading ?? 0),
        ])
    );
}

// GET previous shift meters for legacy pages that still offer "copy from previous".
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();
        const start = getStartOfDayBangkokUTC(dateStr);
        const end = getEndOfDayBangkokUTC(dateStr);

        const todayShifts = await prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId: auth.station.dbId,
                    date: {
                        gte: start,
                        lte: end,
                    },
                },
            },
            orderBy: { shiftNumber: 'asc' },
            include: {
                dailyRecord: { select: { date: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
            },
        });

        const openShift = todayShifts.find((shift) => shift.status === 'OPEN');
        const previousTodayShift = openShift
            ? todayShifts
                .filter((shift) => shift.shiftNumber < openShift.shiftNumber && shift.meters.length > 0)
                .at(-1)
            : todayShifts
                .filter((shift) => shift.shiftNumber === 1 && shift.status !== 'OPEN' && shift.meters.length > 0)
                .at(-1);

        let sourceShift = previousTodayShift as PreviousShift | undefined;

        if (!sourceShift) {
            sourceShift = await prisma.shift.findFirst({
                where: {
                    status: { in: ['CLOSED', 'LOCKED'] },
                    dailyRecord: {
                        stationId: auth.station.dbId,
                        date: { lt: start },
                    },
                    meters: { some: {} },
                },
                orderBy: [
                    { dailyRecord: { date: 'desc' } },
                    { shiftNumber: 'desc' },
                ],
                include: {
                    dailyRecord: { select: { date: true } },
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                },
            }) as PreviousShift | null ?? undefined;
        }

        if (!sourceShift) {
            return HttpErrors.notFound('ไม่พบข้อมูลกะก่อน');
        }

        return NextResponse.json({
            shift: {
                id: sourceShift.id,
                shiftNumber: sourceShift.shiftNumber,
                dateKey: toBangkokDateKey(sourceShift.dailyRecord.date),
            },
            meters: serializeMeters(sourceShift),
        });
    } catch (error) {
        console.error('[Previous Shift GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
