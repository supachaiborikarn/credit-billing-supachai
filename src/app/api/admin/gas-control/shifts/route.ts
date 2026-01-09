import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import type { ShiftWithDetails } from '@/types/gas-control';

// GET: List shifts with filters
export async function GET(request: NextRequest) {
    try {
        // Check admin session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        // Use station-5/station-6 directly (this is how data is stored in DB)
        const stationId = searchParams.get('stationId') || 'station-5';
        const startDateStr = searchParams.get('startDate') || getTodayBangkok();
        const endDateStr = searchParams.get('endDate') || getTodayBangkok();
        const staffId = searchParams.get('staffId');
        const shiftId = searchParams.get('shiftId'); // For single shift detail

        // If shiftId provided, get single shift detail
        if (shiftId) {
            const shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: {
                    staff: { select: { id: true, name: true } },
                    closedBy: { select: { name: true } },
                    lockedBy: { select: { name: true } },
                    meters: {
                        orderBy: { nozzleNumber: 'asc' }
                    },
                    reconciliation: true,
                    dailyRecord: {
                        include: {
                            station: { select: { name: true } }
                        }
                    }
                }
            });

            if (!shift) {
                return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
            }

            // Get transactions for this shift's date and time period
            const shiftStartOfDay = getStartOfDayBangkok(shift.dailyRecord.date.toISOString().split('T')[0]);
            const shiftEndOfDay = getEndOfDayBangkok(shift.dailyRecord.date.toISOString().split('T')[0]);

            // Get transactions for the shift period
            const transactions = await prisma.transaction.findMany({
                where: {
                    stationId: shift.dailyRecord.stationId,
                    date: { gte: shiftStartOfDay, lte: shiftEndOfDay },
                    deletedAt: null,
                    // Simple shift association - in a real implementation, we'd track shiftId on transactions
                },
                include: {
                    recordedBy: { select: { name: true } }
                },
                orderBy: { date: 'desc' }
            });

            const shiftDetail: ShiftWithDetails = {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                staffId: shift.staffId,
                staffName: shift.staff?.name || '-',
                status: shift.status as 'OPEN' | 'CLOSED' | 'LOCKED',
                openingStock: shift.openingStock,
                closingStock: shift.closingStock,
                createdAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                lockedAt: shift.lockedAt?.toISOString() || null,
                meters: shift.meters.map(m => ({
                    id: m.id,
                    nozzleNumber: m.nozzleNumber,
                    startReading: Number(m.startReading),
                    endReading: m.endReading ? Number(m.endReading) : null,
                    soldQty: m.soldQty ? Number(m.soldQty) : null,
                    startPhoto: m.startPhoto,
                    endPhoto: m.endPhoto,
                    capturedBy: null, // Would need to join with users
                    capturedAt: m.capturedAt?.toISOString() || null,
                    note: m.note
                })),
                transactions: transactions.map(t => ({
                    id: t.id,
                    date: t.date.toISOString(),
                    licensePlate: t.licensePlate,
                    ownerName: t.ownerName,
                    paymentType: t.paymentType,
                    liters: Number(t.liters),
                    pricePerLiter: Number(t.pricePerLiter),
                    amount: Number(t.amount),
                    productType: t.productType,
                    isVoided: t.isVoided,
                    recordedByName: t.recordedBy?.name || '-'
                })),
                reconciliation: shift.reconciliation ? {
                    id: shift.reconciliation.id,
                    expectedFuelAmount: Number(shift.reconciliation.expectedFuelAmount),
                    expectedOtherAmount: Number(shift.reconciliation.expectedOtherAmount),
                    totalExpected: Number(shift.reconciliation.totalExpected),
                    totalReceived: Number(shift.reconciliation.totalReceived),
                    cashReceived: Number(shift.reconciliation.cashReceived),
                    creditReceived: Number(shift.reconciliation.creditReceived),
                    transferReceived: Number(shift.reconciliation.transferReceived),
                    variance: Number(shift.reconciliation.variance),
                    varianceStatus: shift.reconciliation.varianceStatus as 'GREEN' | 'YELLOW' | 'RED'
                } : null
            };

            return NextResponse.json({ shift: shiftDetail });
        }

        // List shifts with filters
        const startDate = getStartOfDayBangkok(startDateStr);
        const endDate = getEndOfDayBangkok(endDateStr);

        const shifts = await prisma.shift.findMany({
            where: {
                dailyRecord: {
                    stationId,
                    date: { gte: startDate, lte: endDate }
                },
                ...(staffId && { staffId })
            },
            include: {
                staff: { select: { id: true, name: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
                reconciliation: true,
                dailyRecord: {
                    select: {
                        date: true,
                        stationId: true
                    }
                }
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'asc' }
            ]
        });

        const formattedShifts = shifts.map(shift => {
            const totalMeterLiters = shift.meters.reduce((sum, m) => {
                const sold = m.endReading ? Number(m.endReading) - Number(m.startReading) : 0;
                return sum + sold;
            }, 0);

            return {
                id: shift.id,
                date: shift.dailyRecord.date.toISOString().split('T')[0],
                shiftNumber: shift.shiftNumber,
                shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                staffId: shift.staffId,
                staffName: shift.staff?.name || '-',
                status: shift.status,
                createdAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                meterCount: shift.meters.length,
                totalMeterLiters,
                totalSales: shift.reconciliation ? Number(shift.reconciliation.totalReceived) : 0,
                variance: shift.reconciliation ? Number(shift.reconciliation.variance) : null,
                varianceStatus: shift.reconciliation?.varianceStatus || null
            };
        });

        return NextResponse.json({
            shifts: formattedShifts,
            total: formattedShifts.length
        });
    } catch (error) {
        console.error('[Gas Control Shifts]:', error);
        return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
    }
}
