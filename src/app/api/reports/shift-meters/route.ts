import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface ShiftMeter {
    nozzleNumber: number;
    startReading: Decimal;
    endReading: Decimal | null;
    soldQty: Decimal | null;
    startPhoto: string | null;
    endPhoto: string | null;
}

interface ShiftWithRelations {
    id: string;
    shiftNumber: number;
    status: string;
    createdAt: Date;
    closedAt: Date | null;
    openingStock: number | null;
    closingStock: number | null;
    dailyRecord: {
        date: Date;
        station: { id: string; name: string };
    };
    staff: { name: string } | null;
    closedBy: { name: string } | null;
    meters: ShiftMeter[];
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause
        const where: Record<string, unknown> = {};

        if (stationId) {
            where.dailyRecord = { stationId };
        }

        if (startDate || endDate) {
            where.dailyRecord = {
                ...where.dailyRecord as object,
                date: {
                    ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                    ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
                }
            };
        }

        // Fetch shifts with meter readings
        const shifts = await prisma.shift.findMany({
            where,
            include: {
                dailyRecord: {
                    select: {
                        date: true,
                        station: { select: { id: true, name: true } }
                    }
                },
                staff: { select: { name: true } },
                closedBy: { select: { name: true } },
                meters: {
                    select: {
                        nozzleNumber: true,
                        startReading: true,
                        endReading: true,
                        soldQty: true,
                        startPhoto: true,
                        endPhoto: true
                    },
                    orderBy: { nozzleNumber: 'asc' }
                }
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'desc' }
            ]
        }) as unknown as ShiftWithRelations[];

        // Transform data
        const result = shifts.map((shift: ShiftWithRelations) => ({
            id: shift.id,
            date: shift.dailyRecord.date.toISOString().split('T')[0],
            stationId: shift.dailyRecord.station.id,
            stationName: shift.dailyRecord.station.name,
            shiftNumber: shift.shiftNumber,
            status: shift.status,
            staff: shift.staff?.name || null,
            closedBy: shift.closedBy?.name || null,
            openedAt: shift.createdAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
            openingStock: shift.openingStock,
            closingStock: shift.closingStock,
            meters: shift.meters.map((m: ShiftMeter) => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
                soldQty: m.soldQty ? Number(m.soldQty) : null,
                startPhoto: m.startPhoto,
                endPhoto: m.endPhoto
            }))
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
