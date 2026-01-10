import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getTodayBangkok, getStartOfDayBangkokUTC, getEndOfDayBangkokUTC, resolveGasStation, getNonGasStationError } from '@/lib/gas';

/**
 * POST /api/v2/gas/[stationId]/shift/close
 * Close the current shift with reconciliation data (GAS stations only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }
        const body = await request.json();
        const { shiftId, reconciliation } = body;

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId: string | null = null;

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });
            userId = session?.userId || null;
        }

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
        }

        // Get shift
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                meters: true,
                dailyRecord: true
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        if (shift.status !== 'OPEN') {
            return NextResponse.json({ error: 'Shift is not open' }, { status: 400 });
        }

        // Validate all meters have end readings
        const missingEndMeters = shift.meters.filter(m => !m.endReading);
        if (missingEndMeters.length > 0) {
            return NextResponse.json({
                error: `Missing end readings for nozzles: ${missingEndMeters.map(m => m.nozzleNumber).join(', ')}`
            }, { status: 400 });
        }

        // Check gauge end readings exist
        const today = getTodayBangkok();
        const startOfDay = getStartOfDayBangkokUTC(today);
        const endOfDay = getEndOfDayBangkokUTC(today);

        const endGaugeCount = await prisma.gaugeReading.count({
            where: {
                stationId: station.dbId,
                shiftNumber: shift.shiftNumber,
                notes: 'end',
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (endGaugeCount < 3) {
            return NextResponse.json({ error: 'ต้องบันทึกเกจปิดกะให้ครบ 3 ถัง' }, { status: 400 });
        }

        // Calculate expected amount from meters
        const gasPrice = shift.dailyRecord.gasPrice ? Number(shift.dailyRecord.gasPrice) : 16.09;
        const totalLiters = shift.meters.reduce((sum, m) => {
            if (m.soldQty) return sum + Number(m.soldQty);
            if (m.startReading && m.endReading) {
                return sum + (Number(m.endReading) - Number(m.startReading));
            }
            return sum;
        }, 0);
        const expectedFuelAmount = totalLiters * gasPrice;

        // Create or update reconciliation
        const { cashReceived, creditReceived, cardReceived, transferReceived, expectedOtherAmount = 0, varianceNote } = reconciliation || {};

        const totalExpected = expectedFuelAmount + (expectedOtherAmount || 0);
        const totalReceived = (cashReceived || 0) + (creditReceived || 0) + (cardReceived || 0) + (transferReceived || 0);
        const variance = totalReceived - totalExpected;

        // Determine variance status
        let varianceStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        if (Math.abs(variance) > 500) {
            varianceStatus = 'RED';
        } else if (Math.abs(variance) > 100) {
            varianceStatus = 'YELLOW';
        }

        await prisma.shiftReconciliation.upsert({
            where: { shiftId },
            update: {
                expectedFuelAmount,
                expectedOtherAmount: expectedOtherAmount || 0,
                totalExpected,
                cashReceived: cashReceived || 0,
                creditReceived: creditReceived || 0,
                transferReceived: transferReceived || 0,
                totalReceived,
                variance,
                varianceStatus
            },
            create: {
                shiftId,
                expectedFuelAmount,
                expectedOtherAmount: expectedOtherAmount || 0,
                totalExpected,
                cashReceived: cashReceived || 0,
                creditReceived: creditReceived || 0,
                transferReceived: transferReceived || 0,
                totalReceived,
                variance,
                varianceStatus
            }
        });

        // Close shift
        await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: userId,
                varianceNote: varianceNote || null
            }
        });

        return NextResponse.json({
            success: true,
            message: 'ปิดกะสำเร็จ',
            summary: {
                liters: totalLiters,
                expected: totalExpected,
                received: totalReceived,
                variance
            }
        });
    } catch (error) {
        console.error('[Shift Close]:', error);
        return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 });
    }
}
