import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET: Get meters by shift
// PUT: Update meter with audit log
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
        const shiftId = searchParams.get('shiftId');

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId required' }, { status: 400 });
        }

        const meters = await prisma.meterReading.findMany({
            where: { shiftId },
            orderBy: { nozzleNumber: 'asc' }
        });

        // Get audit logs for these meters
        const meterIds = meters.map(m => m.id);
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                model: 'MeterReading',
                recordId: { in: meterIds }
            },
            include: {
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        return NextResponse.json({
            meters: meters.map(m => ({
                id: m.id,
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
                soldQty: m.soldQty ? Number(m.soldQty) : null,
                startPhoto: m.startPhoto,
                endPhoto: m.endPhoto,
                note: m.note
            })),
            auditLogs: auditLogs.map(log => ({
                id: log.id,
                meterId: log.recordId,
                action: log.action,
                oldData: log.oldData,
                newData: log.newData,
                editedBy: log.user?.name || 'System',
                editedAt: log.createdAt.toISOString()
            }))
        });
    } catch (error) {
        console.error('[Gas Control Meters GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch meters' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Check admin session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { id: true, role: true, name: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { meterId, field, newValue, reason } = body;

        if (!meterId || !field || newValue === undefined || !reason) {
            return NextResponse.json({
                error: 'Required: meterId, field, newValue, reason'
            }, { status: 400 });
        }

        if (!['startReading', 'endReading'].includes(field)) {
            return NextResponse.json({
                error: 'field must be startReading or endReading'
            }, { status: 400 });
        }

        // Get current meter
        const meter = await prisma.meterReading.findUnique({
            where: { id: meterId }
        });

        if (!meter) {
            return NextResponse.json({ error: 'Meter not found' }, { status: 404 });
        }

        const oldValue = field === 'startReading'
            ? Number(meter.startReading)
            : (meter.endReading ? Number(meter.endReading) : null);

        // Calculate new soldQty if both readings exist
        let soldQty: number | null = meter.soldQty ? Number(meter.soldQty) : null;
        if (field === 'startReading') {
            if (meter.endReading) {
                soldQty = Number(meter.endReading) - newValue;
            }
        } else if (field === 'endReading') {
            soldQty = newValue - Number(meter.startReading);
        }

        // Update meter
        const updatedMeter = await prisma.meterReading.update({
            where: { id: meterId },
            data: {
                [field]: newValue,
                soldQty,
                note: reason
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'UPDATE',
                model: 'MeterReading',
                recordId: meterId,
                oldData: { [field]: oldValue },
                newData: { [field]: newValue, reason }
            }
        });

        return NextResponse.json({
            success: true,
            meter: {
                id: updatedMeter.id,
                nozzleNumber: updatedMeter.nozzleNumber,
                startReading: Number(updatedMeter.startReading),
                endReading: updatedMeter.endReading ? Number(updatedMeter.endReading) : null,
                soldQty: updatedMeter.soldQty ? Number(updatedMeter.soldQty) : null
            },
            audit: {
                field,
                oldValue,
                newValue,
                reason,
                editedBy: session.user.name
            }
        });
    } catch (error) {
        console.error('[Gas Control Meters PUT]:', error);
        return NextResponse.json({ error: 'Failed to update meter' }, { status: 500 });
    }
}
