import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasStationAccess, shiftBelongsToStation } from '@/lib/gas/api-guards';

// PUT — retired legacy close path. Canonical GAS shift close owns mutation.
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    void request;
    const { id } = await params;
    const auth = await requireGasStationAccess(id);
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'legacy GAS shift-detail close API retired',
        canonicalOperations: `/stations/station-${auth.station.index}/operations`,
        canonicalCloseApi: `/api/v2/gas/${auth.station.index}/shift/close`,
    }, { status: 410 });
}

// GET - Get shift details with meter comparison
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { id, shiftId } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                staff: { select: { name: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
                dailyRecord: { select: { stationId: true } },
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้' }, { status: 404 });
        }

        if (!shiftBelongsToStation(shift, auth.station)) {
            return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
        }

        const meterComparison = shift.meters.map(m => ({
            nozzleNumber: m.nozzleNumber,
            startReading: Number(m.startReading),
            endReading: m.endReading ? Number(m.endReading) : null,
            difference: m.endReading ? Number(m.endReading) - Number(m.startReading) : null,
        }));

        const totalLitersSold = meterComparison
            .filter(m => m.difference !== null)
            .reduce((sum, m) => sum + (m.difference || 0), 0);

        return NextResponse.json({
            id: shift.id,
            shiftNumber: shift.shiftNumber,
            shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
            staffName: shift.staff?.name || '-',
            status: shift.status,
            createdAt: shift.createdAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
            meterComparison,
            totalLitersSold,
        });
    } catch (error) {
        console.error('Shift GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 });
    }
}
