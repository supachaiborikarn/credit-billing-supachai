import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { selectCanonicalFullStationShift } from '@/lib/full-station-shift-scope';

type EnsureOpenFullStationShiftInput = {
    dailyRecordId: string;
    userId?: string | null;
    requireStartedMeters?: boolean;
};

const MAX_CREATE_ATTEMPTS = 3;

function isShiftCreateRace(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034');
}

export async function ensureOpenFullStationShiftForDailyRecord({
    dailyRecordId,
    userId,
    requireStartedMeters = true,
}: EnsureOpenFullStationShiftInput) {
    for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
        try {
            return await prisma.$transaction(async tx => {
                const existingOpenShifts = await tx.shift.findMany({
                    where: {
                        dailyRecordId,
                        status: 'OPEN',
                    },
                    include: {
                        meters: {
                            select: {
                                startReading: true,
                                endReading: true,
                                startPhoto: true,
                                endPhoto: true,
                            },
                        },
                        _count: { select: { transactions: true } },
                    },
                });
                const existingOpenShift = selectCanonicalFullStationShift(existingOpenShifts);

                if (existingOpenShift) {
                    await linkDailyMetersToShift(tx, dailyRecordId, existingOpenShift.id, userId);
                    return existingOpenShift;
                }

                const dailyRecord = await tx.dailyRecord.findUnique({
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

                const hasStartedMeters = dailyRecord.meters.some(meter => Number(meter.startReading) > 0);
                if (requireStartedMeters && !hasStartedMeters) {
                    return null;
                }

                const nextShiftNumber = Math.max(0, ...dailyRecord.shifts.map(shift => shift.shiftNumber)) + 1;
                const newShift = await tx.shift.create({
                    data: {
                        dailyRecordId,
                        shiftNumber: nextShiftNumber,
                        staffId: userId || null,
                        status: 'OPEN',
                    },
                });

                await linkDailyMetersToShift(tx, dailyRecordId, newShift.id, userId);
                return newShift;
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            if (attempt < MAX_CREATE_ATTEMPTS && isShiftCreateRace(error)) {
                continue;
            }

            throw error;
        }
    }

    return null;
}

async function linkDailyMetersToShift(
    tx: Prisma.TransactionClient,
    dailyRecordId: string,
    shiftId: string,
    userId?: string | null
) {
    await tx.meterReading.updateMany({
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
