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
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = id.startsWith('station-') ? id : `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { action, shiftId } = body;

        if (action === 'force-close' && shiftId) {
            const shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: { dailyRecord: { select: { stationId: true } } },
            });

            if (!shift || shift.dailyRecord.stationId !== stationId) {
                return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
            }

            // Force close the old shift
            await prisma.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date(),
                    varianceNote: 'Force closed - กะค้างจากวันก่อน',
                },
            });

            return NextResponse.json({ success: true, message: 'Shift force closed' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('[Shift Status POST]:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}
