import { prisma } from '@/lib/prisma';
import { formatDateBangkok } from '@/lib/date-utils';
import { selectCanonicalFullStationShift } from '@/lib/full-station-shift-scope';

/**
 * Only the latest prior business record can block or recover the next shift.
 * Older legacy OPEN rows must not keep resurfacing after a newer day was closed.
 */
export async function findLatestPriorOpenFullShift(stationId: string, before: Date) {
    const dailyRecord = await prisma.dailyRecord.findFirst({
        where: {
            stationId,
            date: { lt: before },
            shifts: { some: {} },
        },
        orderBy: { date: 'desc' },
        include: {
            shifts: {
                where: { status: 'OPEN' },
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
        status: 'OPEN' as const,
        businessDate: formatDateBangkok(dailyRecord.date),
        openedAt: shift.createdAt.toISOString(),
        closedAt: null,
        staffName: shift.staff?.name || null,
    };
}
