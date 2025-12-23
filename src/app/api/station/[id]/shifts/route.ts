import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '@/lib/date-utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig) {
            return NextResponse.json({ error: 'Station not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const startOfDay = getStartOfDayBangkok(dateParam);
        const endOfDay = getEndOfDayBangkok(dateParam);

        const stationId = `station-${id}`;

        // Get daily record with shifts
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                shifts: {
                    orderBy: { shiftNumber: 'asc' }
                }
            }
        });

        // Find current open shift
        const currentShift = dailyRecord?.shifts.find(s => s.status === 'OPEN') || null;

        return NextResponse.json({
            dailyRecord,
            shifts: dailyRecord?.shifts || [],
            currentShift: currentShift ? {
                id: currentShift.id,
                shiftNumber: currentShift.shiftNumber,
                status: currentShift.status,
                staffName: currentShift.staffId,
                createdAt: currentShift.createdAt,
                closedAt: currentShift.closedAt
            } : null
        });
    } catch (error) {
        console.error('Station shifts GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig) {
            return NextResponse.json({ error: 'Station not found' }, { status: 404 });
        }

        const body = await request.json();
        const { action, staffName, shiftId } = body;

        const stationId = `station-${id}`;
        const today = new Date().toISOString().split('T')[0];
        const startOfDay = getStartOfDayBangkok(today);
        const endOfDay = getEndOfDayBangkok(today);

        // Get or create station
        await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: 'GAS',
            }
        });

        // Get or create daily record
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: { shifts: true }
        });

        if (!dailyRecord) {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId,
                    date: startOfDay,
                    status: 'OPEN'
                },
                include: { shifts: true }
            });
        }

        if (action === 'open') {
            // Check if there's already an open shift
            const openShift = dailyRecord.shifts.find(s => s.status === 'OPEN');
            if (openShift) {
                return NextResponse.json({ error: 'มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อน' }, { status: 400 });
            }

            // Determine shift number
            const closedShifts = dailyRecord.shifts.filter(s => s.status === 'CLOSED');
            const shiftNumber = closedShifts.length + 1;

            if (shiftNumber > 2) {
                return NextResponse.json({ error: 'วันนี้เปิดครบ 2 กะแล้ว' }, { status: 400 });
            }

            // Create new shift
            const newShift = await prisma.shift.create({
                data: {
                    dailyRecordId: dailyRecord.id,
                    shiftNumber,
                    staffId: staffName || null,
                    status: 'OPEN'
                }
            });

            return NextResponse.json({
                success: true,
                shift: {
                    id: newShift.id,
                    shiftNumber: newShift.shiftNumber,
                    status: newShift.status,
                    staffName: newShift.staffId,
                    createdAt: newShift.createdAt
                }
            });
        }

        if (action === 'close') {
            if (!shiftId) {
                return NextResponse.json({ error: 'Shift ID required' }, { status: 400 });
            }

            // Close the shift
            const closedShift = await prisma.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date()
                }
            });

            return NextResponse.json({
                success: true,
                shift: {
                    id: closedShift.id,
                    shiftNumber: closedShift.shiftNumber,
                    status: closedShift.status,
                    closedAt: closedShift.closedAt
                }
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Station shifts POST error:', error);
        return NextResponse.json({ error: 'Failed to process shift' }, { status: 500 });
    }
}
