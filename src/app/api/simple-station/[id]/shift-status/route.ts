import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { requireStationAccessApi } from '@/lib/api-auth';

// GET /api/simple-station/[id]/shift-status - Check shift status for mandatory workflow
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Normalize stationId - could be '4' or 'station-4'
        const stationId = id.startsWith('station-') ? id : `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const today = getTodayBangkok();
        const startOfToday = getStartOfDayBangkok(today);
        const endOfToday = getEndOfDayBangkok(today);

        // Find today's daily record
        const todayRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: { gte: startOfToday, lte: endOfToday },
            },
            include: {
                shifts: {
                    where: { status: 'OPEN' },
                    orderBy: { shiftNumber: 'desc' },
                    take: 1,
                },
            },
        });

        // Find any OLD unclosed shifts (before today)
        const oldUnclosedShift = await prisma.shift.findFirst({
            where: {
                dailyRecord: {
                    stationId,
                    date: { lt: startOfToday },
                },
                status: 'OPEN',
            },
            include: {
                dailyRecord: { select: { date: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Today's current open shift
        const currentShift = todayRecord?.shifts?.find(s => s.status === 'OPEN') || null;

        return NextResponse.json({
            currentShift: currentShift ? {
                id: currentShift.id,
                shiftNumber: currentShift.shiftNumber,
                status: currentShift.status,
                createdAt: currentShift.createdAt.toISOString(),
            } : null,
            oldUnclosedShift: oldUnclosedShift ? {
                id: oldUnclosedShift.id,
                shiftNumber: oldUnclosedShift.shiftNumber,
                status: oldUnclosedShift.status,
                createdAt: oldUnclosedShift.createdAt.toISOString(),
                date: oldUnclosedShift.dailyRecord.date.toISOString(),
            } : null,
            todayHasShift: !!todayRecord?.shifts?.length,
        });
    } catch (error) {
        console.error('[Shift Status GET]:', error);
        return NextResponse.json(
            { error: 'Failed to check shift status' },
            { status: 500 }
        );
    }
}

// POST /api/simple-station/[id]/shift-status - Force close old shift
// POST /api/simple-station/[id]/shift-status - retired legacy force-close mutation
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const stationId = id.startsWith('station-') ? id : `station-${id}`;
    const auth = await requireStationAccessApi(stationId);
    if (auth.response) return auth.response;
    void request;

    const replacement = stationId === 'station-1'
        ? '/stations/station-1/operations'
        : `/stations/${stationId}/history`;

    return NextResponse.json({
        error: 'Legacy SIMPLE force-close API retired',
        retired: true,
        replacement,
        message: stationId === 'station-1'
            ? 'ใช้ canonical Operations สำหรับจัดการกะของ station-1'
            : 'สถานี SIMPLE นี้ย้ายงานหน้าปั๊มไป POS แล้ว และระบบนี้เก็บเฉพาะประวัติ',
    }, { status: 410 });
}
