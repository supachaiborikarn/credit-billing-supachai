import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Close shift (add end meter readings)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { shiftId } = await params;
        const body = await request.json();
        const { meters } = body; // Array of { nozzleNumber, endReading }

        // Get shift
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: { meters: true }
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

        // Close the shift
        const updatedShift = await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
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
