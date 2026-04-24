import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { requireAdminApi } from '@/lib/api-auth';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

interface MeterInput {
    nozzleNumber: number;
    startReading: number;
}

// GET shifts for a gas station by date
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const stationId = auth.station.dbId;

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

        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const stationId = auth.station.dbId;

        const body = await request.json();
        const { shiftNumber: providedShiftNumber, meters, dateStr, action, shiftId } = body;

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
            const openShift = shiftId
                ? await prisma.shift.findUnique({
                    where: { id: shiftId },
                    include: {
                        dailyRecord: { select: { stationId: true } },
                        meters: true,
                    }
                })
                : await prisma.shift.findFirst({
                    where: {
                        dailyRecord: { stationId, date },
                        status: 'OPEN'
                    },
                    include: {
                        dailyRecord: { select: { stationId: true } },
                        meters: true
                    }
                });

            if (openShift && openShift.dailyRecord.stationId !== stationId) {
                return NextResponse.json({ error: 'กะไม่ตรงกับสถานีนี้' }, { status: 403 });
            }

            if (openShift && openShift.status !== 'OPEN') {
                return HttpErrors.badRequest('กะนี้ไม่ได้เปิดอยู่');
            }

            if (!openShift) {
                return HttpErrors.badRequest('ไม่มีกะที่เปิดอยู่');
            }

            const closedShift = await prisma.$transaction(async (tx) => {
                for (const meter of openShift.meters) {
                    if (meter.endReading === null) {
                        await tx.meterReading.update({
                            where: { id: meter.id },
                            data: {
                                endReading: meter.startReading,
                                soldQty: 0,
                            }
                        });
                    }
                }

                const updatedShift = await tx.shift.update({
                    where: { id: openShift.id },
                    data: { status: 'CLOSED', closedAt: new Date(), closedById: auth.user.id }
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: 'CLOSE',
                        model: 'Shift',
                        recordId: updatedShift.id,
                        newData: { closedAt: new Date().toISOString(), source: 'gas-station-shifts' }
                    }
                });

                return updatedShift;
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
            const adminAuth = await requireAdminApi();
            if (adminAuth.response) return adminAuth.response;

            // Handle lock action (Admin only - ล็อกกะถาวร)
            const date = getStartOfDayBangkok(dateStr || getTodayBangkok());
            const closedShift = shiftId
                ? await prisma.shift.findUnique({
                    where: { id: shiftId },
                    include: { dailyRecord: { select: { stationId: true } } }
                })
                : await prisma.shift.findFirst({
                    where: {
                        dailyRecord: { stationId, date },
                        status: 'CLOSED'
                    },
                    include: { dailyRecord: { select: { stationId: true } } }
                });

            if (!closedShift) {
                return HttpErrors.badRequest('ไม่มีกะที่ปิดแล้ว');
            }

            if (closedShift.dailyRecord.stationId !== stationId) {
                return NextResponse.json({ error: 'กะไม่ตรงกับสถานีนี้' }, { status: 403 });
            }

            if (closedShift.status !== 'CLOSED') {
                return HttpErrors.badRequest('กะนี้ยังไม่ได้ปิด');
            }

            const lockedShift = await prisma.$transaction(async (tx) => {
                const updatedShift = await tx.shift.update({
                    where: { id: closedShift.id },
                    data: {
                        status: 'LOCKED',
                        lockedAt: new Date(),
                        lockedById: adminAuth.user.id
                    }
                });

                await tx.auditLog.create({
                    data: {
                        userId: adminAuth.user.id,
                        action: 'LOCK',
                        model: 'Shift',
                        recordId: updatedShift.id,
                        newData: { lockedAt: new Date().toISOString(), source: 'gas-station-shifts' }
                    }
                });

                return updatedShift;
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

        if (action === 'open' && (!Array.isArray(meters) || meters.length === 0)) {
            return HttpErrors.badRequest('กรุณาเปิดกะผ่านหน้าเปิดกะใหม่ เพื่อกรอกราคาขาย มิเตอร์ และเกจให้ครบก่อนบันทึก');
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
                staffId: auth.user.id,
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
