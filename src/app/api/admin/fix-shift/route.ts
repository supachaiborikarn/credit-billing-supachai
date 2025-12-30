import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Temporary endpoint to fix stuck shifts
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shiftId, action, newNumber } = body;

        if (action === 'force-close' && shiftId) {
            // Force close a stuck shift
            const shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: { dailyRecord: true }
            });

            if (!shift) {
                return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
            }

            // Update shift to closed
            await prisma.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date()
                }
            });

            // Also close the daily record
            await prisma.dailyRecord.update({
                where: { id: shift.dailyRecordId },
                data: { status: 'CLOSED' }
            });

            return NextResponse.json({
                success: true,
                message: `Shift ${shift.shiftNumber} force closed`
            });
        }

        if (action === 'list-open') {
            // List all open shifts across all stations
            const openShifts = await prisma.shift.findMany({
                where: { status: 'OPEN' },
                include: {
                    dailyRecord: {
                        select: { stationId: true, date: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return NextResponse.json({
                openShifts: openShifts.map(s => ({
                    id: s.id,
                    shiftNumber: s.shiftNumber,
                    stationId: s.dailyRecord.stationId,
                    date: s.dailyRecord.date,
                    createdAt: s.createdAt
                }))
            });
        }

        if (action === 'delete' && shiftId) {
            // Delete a shift completely
            await prisma.shift.delete({
                where: { id: shiftId }
            });
            return NextResponse.json({ success: true, message: 'Shift deleted' });
        }

        if (action === 'update-number' && shiftId) {
            await prisma.shift.update({
                where: { id: shiftId },
                data: { shiftNumber: newNumber || 1 }
            });
            return NextResponse.json({ success: true, message: 'Shift number updated' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Fix shift error:', error);
        return NextResponse.json({ error: 'Failed to fix shift' }, { status: 500 });
    }
}
