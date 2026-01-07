import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/station/[id]/shift-meters - Save meter readings for current open shift
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
        const { type, meters, staffId } = body;

        // Find current open shift
        const openShift = await prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: { stationId }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!openShift) {
            return NextResponse.json({ error: 'ไม่พบกะที่เปิดอยู่' }, { status: 400 });
        }

        // Save meter readings linked to this shift
        for (const meter of meters) {
            await prisma.meterReading.upsert({
                where: {
                    shiftId_nozzleNumber: {
                        shiftId: openShift.id,
                        nozzleNumber: meter.nozzleNumber,
                    }
                },
                update: type === 'start'
                    ? {
                        startReading: meter.reading,
                        capturedById: staffId,
                        capturedAt: new Date()
                    }
                    : {
                        endReading: meter.reading,
                        soldQty: meter.soldQty || null,
                        capturedById: staffId,
                        capturedAt: new Date()
                    },
                create: {
                    shiftId: openShift.id,
                    dailyRecordId: openShift.dailyRecordId,
                    nozzleNumber: meter.nozzleNumber,
                    startReading: type === 'start' ? meter.reading : 0,
                    endReading: type === 'end' ? meter.reading : null,
                    soldQty: type === 'end' ? meter.soldQty : null,
                    capturedById: staffId,
                    capturedAt: new Date()
                }
            });
        }

        return NextResponse.json({ success: true, shiftId: openShift.id });
    } catch (error) {
        console.error('Shift Meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save shift meters' }, { status: 500 });
    }
}

// GET /api/station/[id]/shift-meters - Get meter readings for current open shift
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId');

        let shift;
        if (shiftId) {
            shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: {
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                    staff: { select: { name: true } }
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
                    staff: { select: { name: true } }
                }
            });
        }

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะ' }, { status: 404 });
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
