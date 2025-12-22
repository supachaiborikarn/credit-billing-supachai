import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';

interface MeterInput {
    nozzleNumber: number;
    startReading: number;
}

interface ShiftInput {
    shiftNumber: number;
    meters?: MeterInput[];
    dateStr?: string;
}

// GET shifts for a gas station by date
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();

        const date = getStartOfDayBangkok(dateStr);

        // Get daily record with shifts
        const dailyRecord = await prisma.dailyRecord.findUnique({
            where: { stationId_date: { stationId, date } },
            include: {
                shifts: {
                    include: {
                        staff: { select: { id: true, name: true } },
                        meters: true,
                    },
                    orderBy: { shiftNumber: 'asc' },
                }
            }
        });

        if (!dailyRecord) {
            return NextResponse.json({ shifts: [], dailyRecordId: null });
        }

        const formattedShifts = dailyRecord.shifts.map(shift => ({
            id: shift.id,
            shiftNumber: shift.shiftNumber,
            shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
            staffName: shift.staff?.name || '-',
            status: shift.status,
            meters: shift.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
            })),
            createdAt: shift.createdAt.toISOString(),
            closedAt: shift.closedAt?.toISOString() || null,
        }));

        return NextResponse.json({
            dailyRecordId: dailyRecord.id,
            shifts: formattedShifts,
        });
    } catch (error) {
        console.error('[Shifts GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

// POST - Open a new shift
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body: ShiftInput = await request.json();
        const { shiftNumber, meters, dateStr } = body;

        if (!shiftNumber || ![1, 2].includes(shiftNumber)) {
            return HttpErrors.badRequest('กรุณาระบุกะ (1 = กะเช้า, 2 = กะบ่าย)');
        }

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let staffId: string | null = null;

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { userId: true }
            });
            if (session) staffId = session.userId;
        }

        const date = getStartOfDayBangkok(dateStr || getTodayBangkok());

        // Get or create daily record
        const dailyRecord = await prisma.dailyRecord.upsert({
            where: { stationId_date: { stationId, date } },
            update: {},
            create: {
                stationId,
                date,
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                status: 'OPEN',
            }
        });

        // Check if shift already exists
        const existingShift = await prisma.shift.findUnique({
            where: { dailyRecordId_shiftNumber: { dailyRecordId: dailyRecord.id, shiftNumber } }
        });

        if (existingShift) {
            return HttpErrors.conflict(`${shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย'}มีอยู่แล้ว`);
        }

        // Create shift with meters
        const shift = await prisma.shift.create({
            data: {
                dailyRecordId: dailyRecord.id,
                shiftNumber,
                staffId,
                status: 'OPEN',
                meters: {
                    create: (meters || []).map((m: MeterInput) => ({
                        nozzleNumber: m.nozzleNumber,
                        startReading: m.startReading || 0,
                    }))
                }
            },
            include: {
                staff: { select: { name: true } },
                meters: true,
            }
        });

        return NextResponse.json({
            success: true,
            shift: {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                staffName: shift.staff?.name || '-',
                status: shift.status,
                meters: shift.meters,
            }
        });
    } catch (error) {
        console.error('[Shift POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
