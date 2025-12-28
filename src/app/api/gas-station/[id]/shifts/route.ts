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
        const body = await request.json();
        const { shiftNumber: providedShiftNumber, meters, dateStr, action, staffName } = body;

        // Handle action-based requests (from simplified UI)
        let shiftNumber = providedShiftNumber;
        if (action === 'open' && !shiftNumber) {
            // Auto-detect shift number based on existing shifts
            const date = getStartOfDayBangkok(dateStr || getTodayBangkok());
            const existingShifts = await prisma.shift.findMany({
                where: {
                    dailyRecord: { stationId, date }
                },
                orderBy: { shiftNumber: 'desc' }
            });

            if (existingShifts.length === 0) {
                shiftNumber = 1; // First shift
            } else if (existingShifts.some(s => s.status === 'OPEN')) {
                return HttpErrors.badRequest('มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อน');
            } else if (existingShifts.length >= 2) {
                return HttpErrors.badRequest('วันนี้เปิดครบ 2 กะแล้ว');
            } else {
                shiftNumber = 2; // Second shift
            }
        }

        if (action === 'close') {
            // Handle close action
            const date = getStartOfDayBangkok(dateStr || getTodayBangkok());
            const openShift = await prisma.shift.findFirst({
                where: {
                    dailyRecord: { stationId, date },
                    status: 'OPEN'
                }
            });

            if (!openShift) {
                return HttpErrors.badRequest('ไม่มีกะที่เปิดอยู่');
            }

            const closedShift = await prisma.shift.update({
                where: { id: openShift.id },
                data: { status: 'CLOSED', closedAt: new Date() }
            });

            // Get user for audit
            const cookieStore = await cookies();
            const sessionId = cookieStore.get('session')?.value;
            let userId = 'system';
            if (sessionId) {
                const session = await prisma.session.findUnique({
                    where: { id: sessionId },
                    select: { userId: true }
                });
                if (session) userId = session.userId;
            }

            // Audit log
            await prisma.auditLog.create({
                data: {
                    userId,
                    action: 'CLOSE',
                    model: 'Shift',
                    recordId: closedShift.id,
                    newData: { closedAt: new Date().toISOString() }
                }
            });

            return NextResponse.json({
                success: true,
                shift: {
                    id: closedShift.id,
                    shiftNumber: closedShift.shiftNumber,
                    status: closedShift.status
                }
            });
        }

        if (action === 'lock') {
            // Handle lock action (Admin only - ล็อกกะถาวร)
            const date = getStartOfDayBangkok(dateStr || getTodayBangkok());
            const closedShift = await prisma.shift.findFirst({
                where: {
                    dailyRecord: { stationId, date },
                    status: 'CLOSED'
                }
            });

            if (!closedShift) {
                return HttpErrors.badRequest('ไม่มีกะที่ปิดแล้ว');
            }

            // Get user for audit
            const cookieStore = await cookies();
            const sessionId = cookieStore.get('session')?.value;
            let userId = 'system';
            if (sessionId) {
                const session = await prisma.session.findUnique({
                    where: { id: sessionId },
                    select: { userId: true }
                });
                if (session) userId = session.userId;
            }

            const lockedShift = await prisma.shift.update({
                where: { id: closedShift.id },
                data: {
                    status: 'LOCKED',
                    lockedAt: new Date(),
                    lockedById: userId
                }
            });

            // Audit log
            await prisma.auditLog.create({
                data: {
                    userId,
                    action: 'LOCK',
                    model: 'Shift',
                    recordId: lockedShift.id,
                    newData: { lockedAt: new Date().toISOString() }
                }
            });

            return NextResponse.json({
                success: true,
                message: '🔒 กะถูกล็อกเรียบร้อย ไม่สามารถแก้ไขได้อีก',
                shift: {
                    id: lockedShift.id,
                    shiftNumber: lockedShift.shiftNumber,
                    status: lockedShift.status
                }
            });
        }

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
