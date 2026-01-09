import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET: Fetch gauge readings
export async function GET(request: NextRequest) {
    try {
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
        const stationId = searchParams.get('stationId') || 'station-5';

        // Get all gauge readings for this station
        const readings = await prisma.gaugeReading.findMany({
            where: { stationId },
            orderBy: { createdAt: 'desc' },
            take: 30
        });

        // Get user names separately
        const userIds = [...new Set(readings.map(r => r.recordedById).filter(Boolean))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds as string[] } },
            select: { id: true, name: true }
        });
        const userMap = new Map(users.map(u => [u.id, u.name]));

        // Calculate liters from percentage (3 tanks × 2400L = 7200L)
        const TOTAL_CAPACITY = 7200;

        const formattedReadings = readings.map(r => ({
            id: r.id,
            date: r.date.toISOString(),
            percentage: Number(r.percentage),
            liters: (Number(r.percentage) / 100) * TOTAL_CAPACITY,
            recordedBy: r.recordedById ? userMap.get(r.recordedById) || 'Unknown' : 'ระบบ',
            createdAt: r.createdAt.toISOString()
        }));

        return NextResponse.json({ readings: formattedReadings });
    } catch (error) {
        console.error('[Gas Control Gauge GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}

// POST: Save new gauge reading
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { id: true, name: true, role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { stationId, percentage, date } = body;

        if (!stationId || percentage === undefined) {
            return NextResponse.json({ error: 'stationId and percentage required' }, { status: 400 });
        }

        const reading = await prisma.gaugeReading.create({
            data: {
                stationId,
                percentage,
                date: new Date(date || new Date()),
                recordedById: session.user.id,
                tankNumber: 1,
                shiftNumber: 1
            }
        });

        // Calculate liters
        const TOTAL_CAPACITY = 7200;
        const liters = (Number(reading.percentage) / 100) * TOTAL_CAPACITY;

        return NextResponse.json({
            reading: {
                id: reading.id,
                date: reading.date.toISOString(),
                percentage: Number(reading.percentage),
                liters,
                recordedBy: session.user.name,
                createdAt: reading.createdAt.toISOString()
            }
        });
    } catch (error) {
        console.error('[Gas Control Gauge POST]:', error);
        return NextResponse.json({ error: 'Failed to save gauge reading' }, { status: 500 });
    }
}
