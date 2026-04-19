import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { requireStationAccessApi } from '@/lib/api-auth';

// GET /api/station/[id]/shifts/history - Get shift history for a date
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = id.startsWith('station-') ? id : `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Find daily record
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        if (!dailyRecord) {
            return NextResponse.json({
                date: dateStr,
                shifts: [],
            });
        }

        // Get all shifts for this daily record
        const shifts = await prisma.shift.findMany({
            where: {
                dailyRecordId: dailyRecord.id,
            },
            orderBy: {
                shiftNumber: 'asc',
            },
            include: {
                staff: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                closedBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                meters: {
                    select: {
                        nozzleNumber: true,
                        startReading: true,
                        endReading: true,
                        soldQty: true,
                    },
                    orderBy: { nozzleNumber: 'asc' },
                },
            },
        });

        // Transform data
        const shiftsData = shifts.map((shift) => ({
            id: shift.id,
            shiftNumber: shift.shiftNumber,
            staffId: shift.staffId,
            staffName: shift.staff?.name || shift.staffId || null,
            status: shift.status,
            createdAt: shift.createdAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
            closedById: shift.closedById,
            closedByName: shift.closedBy?.name || shift.closedById || null,
            meters: shift.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
                soldQty: m.soldQty ? Number(m.soldQty) : null,
            })),
        }));

        return NextResponse.json({
            date: dateStr,
            shifts: shiftsData,
        });
    } catch (error) {
        console.error('[Shift History GET]:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shift history' },
            { status: 500 }
        );
    }
}
