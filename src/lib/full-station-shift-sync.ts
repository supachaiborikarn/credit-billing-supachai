import { prisma } from '@/lib/prisma';

type EnsureOpenFullStationShiftInput = {
    dailyRecordId: string;
    userId?: string | null;
    requireStartedMeters?: boolean;
};

export async function ensureOpenFullStationShiftForDailyRecord({
    dailyRecordId,
    userId,
    requireStartedMeters = true,
}: EnsureOpenFullStationShiftInput) {
    const existingOpenShift = await prisma.shift.findFirst({
        where: {
            dailyRecordId,
            status: 'OPEN',
        },
        orderBy: { shiftNumber: 'desc' },
    });

    if (existingOpenShift) {
        await linkDailyMetersToShift(dailyRecordId, existingOpenShift.id, userId);
        return existingOpenShift;
    }

    const dailyRecord = await prisma.dailyRecord.findUnique({
        where: { id: dailyRecordId },
        include: {
            meters: { select: { startReading: true } },
            shifts: { select: { shiftNumber: true } },
            station: { select: { type: true } },
        },
    });

    if (!dailyRecord || dailyRecord.station.type !== 'FULL' || dailyRecord.status === 'CLOSED') {
        return null;
    }

    const hasStartedMeters = dailyRecord.meters.some((meter) => Number(meter.startReading) > 0);
    if (requireStartedMeters && !hasStartedMeters) {
        return null;
    }

    const nextShiftNumber = Math.max(0, ...dailyRecord.shifts.map((shift) => shift.shiftNumber)) + 1;

    try {
        const newShift = await prisma.shift.create({
            data: {
                dailyRecordId,
                shiftNumber: nextShiftNumber,
                staffId: userId || null,
                status: 'OPEN',
            },
        });

        await linkDailyMetersToShift(dailyRecordId, newShift.id, userId);
        return newShift;
    } catch (error) {
        const openShift = await prisma.shift.findFirst({
            where: {
                dailyRecordId,
                status: 'OPEN',
            },
            orderBy: { shiftNumber: 'desc' },
        });

        if (openShift) {
            await linkDailyMetersToShift(dailyRecordId, openShift.id, userId);
            return openShift;
        }

        throw error;
    }
}

async function linkDailyMetersToShift(
    dailyRecordId: string,
    shiftId: string,
    userId?: string | null
) {
    await prisma.meterReading.updateMany({
        where: {
            dailyRecordId,
            shiftId: null,
        },
        data: {
            shiftId,
            capturedAt: new Date(),
            ...(userId ? { capturedById: userId } : {}),
        },
    });
}
