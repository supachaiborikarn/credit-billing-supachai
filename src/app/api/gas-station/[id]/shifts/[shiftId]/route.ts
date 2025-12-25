import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok } from '@/lib/date-utils';

// PUT - Close shift (add end meter readings)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { shiftId } = await params;
        const body = await request.json();
        const { meters } = body; // Array of { nozzleNumber, endReading }

        // Get shift with dailyRecord for carry-over logic
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                meters: true,
                dailyRecord: true
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้' }, { status: 404 });
        }

        if (shift.status === 'CLOSED') {
            return NextResponse.json({ error: 'กะนี้ปิดแล้ว' }, { status: 400 });
        }

        // Update meter end readings
        if (meters && Array.isArray(meters)) {
            for (const m of meters) {
                await prisma.meterReading.updateMany({
                    where: {
                        shiftId,
                        nozzleNumber: m.nozzleNumber,
                    },
                    data: {
                        endReading: m.endReading,
                    }
                });
            }
        }

        // Calculate closingStock from gauge readings for this shift
        const LITERS_PER_PERCENT = 98;
        let closingStock: number | null = null;

        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: shift.dailyRecord.stationId,
                shiftNumber: shift.shiftNumber,
                dailyRecordId: shift.dailyRecordId,
                notes: 'end', // Only end readings
            },
            orderBy: { createdAt: 'desc' }
        });

        if (gaugeReadings.length > 0) {
            const totalPercentage = gaugeReadings.reduce((sum, g) => sum + Number(g.percentage), 0);
            closingStock = totalPercentage * LITERS_PER_PERCENT;
        }

        // Close the shift with closingStock
        const updatedShift = await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closingStock: closingStock,
            },
            include: {
                staff: { select: { name: true } },
                meters: true,
            }
        });

        // Calculate meter comparison
        const meterComparison = updatedShift.meters.map(m => ({
            nozzleNumber: m.nozzleNumber,
            startReading: Number(m.startReading),
            endReading: m.endReading ? Number(m.endReading) : 0,
            difference: m.endReading ? Number(m.endReading) - Number(m.startReading) : 0,
        }));

        const totalLitersSold = meterComparison.reduce((sum, m) => sum + m.difference, 0);

        // ===== CARRY-OVER LOGIC: Create next shift with startReading =====
        try {
            const currentShiftNum = updatedShift.shiftNumber;
            const nextShiftNumber = currentShiftNum === 1 ? 2 : 1;

            // Calculate next day's date for shift 2 -> shift 1 transition
            let nextDate: Date;
            if (currentShiftNum === 2) {
                // Shift 2 closes -> Create shift 1 for NEXT day
                const currentDate = new Date(shift.dailyRecord.date);
                currentDate.setDate(currentDate.getDate() + 1);
                nextDate = getStartOfDayBangkok(currentDate.toISOString().split('T')[0]);
            } else {
                // Shift 1 closes -> Create shift 2 for SAME day
                nextDate = shift.dailyRecord.date;
            }

            // Get or create daily record for next shift
            const nextDailyRecord = await prisma.dailyRecord.upsert({
                where: {
                    stationId_date: {
                        stationId: shift.dailyRecord.stationId,
                        date: nextDate
                    }
                },
                update: {},
                create: {
                    stationId: shift.dailyRecord.stationId,
                    date: nextDate,
                    retailPrice: shift.dailyRecord.retailPrice,
                    wholesalePrice: shift.dailyRecord.wholesalePrice,
                    gasPrice: shift.dailyRecord.gasPrice,
                    status: 'OPEN',
                }
            });

            // Check if next shift already exists
            const existingNextShift = await prisma.shift.findUnique({
                where: {
                    dailyRecordId_shiftNumber: {
                        dailyRecordId: nextDailyRecord.id,
                        shiftNumber: nextShiftNumber
                    }
                }
            });

            if (!existingNextShift) {
                // Create next shift with carried-over meter readings and stock
                await prisma.shift.create({
                    data: {
                        dailyRecordId: nextDailyRecord.id,
                        shiftNumber: nextShiftNumber,
                        status: 'OPEN',
                        carryOverFromShiftId: shiftId, // Track carry-over source
                        openingStock: closingStock, // Carry-over closing stock as opening stock
                        meters: {
                            create: updatedShift.meters.map(m => ({
                                nozzleNumber: m.nozzleNumber,
                                startReading: m.endReading || m.startReading, // Use endReading as next startReading
                            }))
                        }
                    }
                });
                console.log(`Carry-over: Created shift ${nextShiftNumber} for ${nextDate.toISOString()} with startReadings and openingStock=${closingStock} from closed shift ${shiftId}`);
            } else {
                // Update existing shift's meter startReadings (if they're still 0)
                for (const m of updatedShift.meters) {
                    if (m.endReading) {
                        await prisma.meterReading.updateMany({
                            where: {
                                shiftId: existingNextShift.id,
                                nozzleNumber: m.nozzleNumber,
                                startReading: 0, // Only update if not set
                            },
                            data: {
                                startReading: m.endReading,
                            }
                        });
                    }
                }
                console.log(`Carry-over: Updated shift ${nextShiftNumber} startReadings from closed shift`);
            }
        } catch (carryOverError) {
            // Log but don't fail the close operation
            console.error('Carry-over failed (non-critical):', carryOverError);
        }
        // ===== END CARRY-OVER LOGIC =====

        return NextResponse.json({
            success: true,
            shift: {
                id: updatedShift.id,
                shiftNumber: updatedShift.shiftNumber,
                shiftName: updatedShift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                staffName: updatedShift.staff?.name || '-',
                status: updatedShift.status,
                closedAt: updatedShift.closedAt?.toISOString(),
            },
            meterComparison,
            totalLitersSold,
        });
    } catch (error) {
        console.error('Shift PUT error:', error);
        return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 });
    }
}

// GET - Get shift details with meter comparison
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { shiftId } = await params;

        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                staff: { select: { name: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้' }, { status: 404 });
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
