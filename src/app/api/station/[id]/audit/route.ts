import { NextRequest, NextResponse } from 'next/server';
import { requireStationAccessApi } from '@/lib/api-auth';
import { getEndOfDayBangkok, getStartOfDayBangkok } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import {
    buildStationAuditEntries,
    type StationAuditRecordMeta,
} from '@/lib/stations/station-audit';
import { isDateKey } from '@/lib/stations/station-history';

function latestClosedAt(shifts: Array<{ closedAt: Date | null }>): Date | null {
    return shifts.reduce<Date | null>((latest, shift) => {
        if (!shift.closedAt) return latest;
        return !latest || shift.closedAt.getTime() > latest.getTime() ? shift.closedAt : latest;
    }, null);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        if (auth.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'ประวัติการแก้ไขดูได้เฉพาะแอดมิน' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const dateKey = searchParams.get('date') || '';
        if (!isDateKey(dateKey)) {
            return NextResponse.json({ error: 'Date is required in YYYY-MM-DD format' }, { status: 400 });
        }

        const date = getStartOfDayBangkok(dateKey);
        const startOfDay = getStartOfDayBangkok(dateKey);
        const endOfDay = getEndOfDayBangkok(dateKey);
        const [dailyRecord, transactions] = await Promise.all([
            prisma.dailyRecord.findUnique({
                where: { stationId_date: { stationId, date } },
                select: {
                    id: true,
                    shifts: {
                        select: { id: true, closedAt: true },
                    },
                    meters: {
                        select: {
                            id: true,
                            shift: { select: { closedAt: true } },
                        },
                    },
                },
            }),
            prisma.transaction.findMany({
                where: {
                    stationId,
                    date: { gte: startOfDay, lte: endOfDay },
                },
                select: {
                    id: true,
                    shift: { select: { closedAt: true } },
                    dailyRecord: {
                        select: {
                            shifts: { select: { closedAt: true } },
                        },
                    },
                },
            }),
        ]);

        const recordMeta = new Map<string, StationAuditRecordMeta>();
        if (dailyRecord) {
            recordMeta.set(dailyRecord.id, {
                entityType: 'DAILY_RECORD',
                closedAt: latestClosedAt(dailyRecord.shifts),
            });
            for (const shift of dailyRecord.shifts) {
                recordMeta.set(shift.id, { entityType: 'SHIFT', closedAt: shift.closedAt });
            }
            for (const meter of dailyRecord.meters) {
                recordMeta.set(meter.id, { entityType: 'METER', closedAt: meter.shift?.closedAt || null });
            }
        }
        for (const transaction of transactions) {
            recordMeta.set(transaction.id, {
                entityType: 'TRANSACTION',
                closedAt: transaction.shift?.closedAt || latestClosedAt(transaction.dailyRecord?.shifts || []),
            });
        }

        if (recordMeta.size === 0) {
            return NextResponse.json({ logs: [] });
        }

        const logs = await prisma.auditLog.findMany({
            where: { recordId: { in: [...recordMeta.keys()] } },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        return NextResponse.json({
            logs: buildStationAuditEntries(logs, recordMeta),
        });
    } catch (error) {
        console.error('Error fetching station audit logs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
