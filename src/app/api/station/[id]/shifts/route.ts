import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { STATIONS, STATION_STAFF } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '@/lib/date-utils';
import { closeShift as closeShiftService, lockShift, validateCloseShift, calculateReconciliation } from '@/services/shift-service';
import { auditShift } from '@/services/audit-service';

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
                    orderBy: { shiftNumber: 'asc' },
                    include: { staff: { select: { name: true } } }
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
                staffName: currentShift.staff?.name || null,
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
        const { action, shiftId } = body;

        const stationId = `station-${id}`;
        const today = new Date().toISOString().split('T')[0];
        const startOfDay = getStartOfDayBangkok(today);
        const endOfDay = getEndOfDayBangkok(today);

        // Get user from session for staff tracking
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId: string | null = null;
        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { userId: true }
            });
            if (session) userId = session.userId;
        }

        // Get or create station
        await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: stationConfig.type,
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
            // Check for old unclosed shifts from previous days
            const oldUnclosedShift = await prisma.shift.findFirst({
                where: {
                    dailyRecord: { stationId },
                    status: 'OPEN',
                    createdAt: { lt: startOfDay } // From before today
                },
                include: {
                    dailyRecord: { select: { date: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (oldUnclosedShift) {
                const oldDate = new Date(oldUnclosedShift.dailyRecord.date);
                const dateStr = oldDate.toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
                return NextResponse.json({
                    error: `มีกะวันที่ ${dateStr} ที่ยังไม่ปิด กรุณาปิดกะเก่าก่อน`,
                    requiresCloseOldShift: true,
                    oldShift: {
                        id: oldUnclosedShift.id,
                        shiftNumber: oldUnclosedShift.shiftNumber,
                        date: oldUnclosedShift.dailyRecord.date,
                        createdAt: oldUnclosedShift.createdAt
                    }
                }, { status: 400 });
            }

            // Check if there's already an open shift today
            const openShift = dailyRecord.shifts.find(s => s.status === 'OPEN');
            if (openShift) {
                return NextResponse.json({ error: 'มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อน' }, { status: 400 });
            }

            // Determine shift number
            const closedShifts = dailyRecord.shifts.filter(s => s.status === 'CLOSED');
            const shiftNumber = closedShifts.length + 1;

            // Get maxShifts from config (default 2)
            const stationStaffConfig = STATION_STAFF[stationId as keyof typeof STATION_STAFF];
            const maxShifts = stationStaffConfig?.maxShifts || 2;

            if (shiftNumber > maxShifts) {
                return NextResponse.json({ error: `วันนี้เปิดครบ ${maxShifts} กะแล้ว` }, { status: 400 });
            }

            // Create new shift
            const newShift = await prisma.shift.create({
                data: {
                    dailyRecordId: dailyRecord.id,
                    shiftNumber,
                    staffId: userId,
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

            // Get user from session
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

            // Validate before closing
            const validation = await validateCloseShift(shiftId);
            if (!validation.valid) {
                return NextResponse.json({
                    error: validation.errors.join(', '),
                    warnings: validation.warnings
                }, { status: 400 });
            }

            // Calculate reconciliation
            const reconciliation = await calculateReconciliation(shiftId);

            // Get varianceNote from body if variance is not green
            const { varianceNote } = body;
            if (reconciliation.varianceStatus !== 'GREEN' && !varianceNote) {
                return NextResponse.json({
                    error: `ยอดต่าง ${reconciliation.variance.toFixed(2)} บาท (${reconciliation.varianceStatus}) กรุณาระบุเหตุผล`,
                    requiresNote: true,
                    reconciliation
                }, { status: 400 });
            }

            // Close with reconciliation
            const result = await closeShiftService(shiftId, userId, varianceNote);

            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            // Audit log
            await auditShift('CLOSE', userId, shiftId, null, {
                reconciliation: result.reconciliation,
                closedAt: new Date().toISOString()
            });

            const closedShift = await prisma.shift.findUnique({ where: { id: shiftId } });

            return NextResponse.json({
                success: true,
                shift: {
                    id: closedShift?.id,
                    shiftNumber: closedShift?.shiftNumber,
                    status: closedShift?.status,
                    closedAt: closedShift?.closedAt
                },
                reconciliation: result.reconciliation
            });
        }

        if (action === 'lock') {
            if (!shiftId) {
                return NextResponse.json({ error: 'Shift ID required' }, { status: 400 });
            }

            // Get user from session
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

            const result = await lockShift(shiftId, userId);

            if (!result.success) {
                return NextResponse.json({ error: result.error }, { status: 400 });
            }

            // Audit log
            await auditShift('LOCK', userId, shiftId, null, { lockedAt: new Date().toISOString() });

            return NextResponse.json({ success: true, message: '🔒 กะถูกล็อกเรียบร้อย ไม่สามารถแก้ไขได้อีก' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Station shifts POST error:', error);
        return NextResponse.json({ error: 'Failed to process shift' }, { status: 500 });
    }
}
