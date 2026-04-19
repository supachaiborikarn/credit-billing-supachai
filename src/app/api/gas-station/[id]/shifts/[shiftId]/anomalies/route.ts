import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStationAccessApi } from '@/lib/api-auth';
import { checkShiftAnomalies, checkShiftAnomaliesFromMeters } from '@/services/anomaly-detection';

async function validateShiftAccess(stationId: string, shiftId: string) {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            dailyRecord: {
                select: { stationId: true },
            },
        },
    });

    if (!shift || shift.dailyRecord.stationId !== stationId) {
        return null;
    }

    return shift;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { id, shiftId } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const shift = await validateShiftAccess(stationId, shiftId);
        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
        }

        const result = await checkShiftAnomalies(shiftId);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Anomaly check error:', error);
        return NextResponse.json({ error: 'Failed to check anomalies' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { id, shiftId } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const shift = await validateShiftAccess(stationId, shiftId);
        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
        }

        const body = await request.json();
        const meters = Array.isArray(body?.meters) ? body.meters : [];

        const result = await checkShiftAnomaliesFromMeters(
            shiftId,
            meters.map((meter: { nozzleNumber: number; soldQty: number }) => ({
                nozzleNumber: Number(meter.nozzleNumber),
                soldQty: Number(meter.soldQty),
            }))
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Anomaly preview error:', error);
        return NextResponse.json({ error: 'Failed to preview anomalies' }, { status: 500 });
    }
}
