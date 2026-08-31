import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStationAccessApi } from '@/lib/api-auth';

// POST /api/station/[id]/shift-meters — retired write compatibility
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    const { id } = await params;
    const stationId = `station-${id}`;
    const auth = await requireStationAccessApi(stationId);
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'legacy shift-meter write API retired',
        canonicalOperations: `/stations/${stationId}/operations`,
        note: 'Use the canonical meter/open-close workflow for station operations.',
    }, { status: 410 });
}

// GET /api/station/[id]/shift-meters - Get meter readings for current open shift
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId');

        let shift;
        if (shiftId) {
            shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: {
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                    staff: { select: { name: true } },
                    dailyRecord: { select: { stationId: true } },
                }
            });
        } else {
            // Get current open shift
            shift = await prisma.shift.findFirst({
                where: {
                    status: 'OPEN',
                    dailyRecord: { stationId }
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                    staff: { select: { name: true } },
                    dailyRecord: { select: { stationId: true } },
                }
            });
        }

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะ' }, { status: 404 });
        }

        if (shift.dailyRecord.stationId !== stationId) {
            return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
        }

        return NextResponse.json({
            shiftId: shift.id,
            shiftNumber: shift.shiftNumber,
            staff: shift.staff?.name || null,
            meters: shift.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
                soldQty: m.soldQty ? Number(m.soldQty) : null
            }))
        });
    } catch (error) {
        console.error('Shift Meters GET error:', error);
        return NextResponse.json({ error: 'Failed to get shift meters' }, { status: 500 });
    }
}
