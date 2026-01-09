import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET: Fetch gauge readings with daily aggregation
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

        // Get all gauge readings for this station (last 60 days worth)
        const readings = await prisma.gaugeReading.findMany({
            where: { stationId },
            orderBy: { createdAt: 'desc' },
            take: 500 // Enough for ~80+ days (6 readings/day max)
        });

        // Get user names
        const userIds = [...new Set(readings.map(r => r.recordedById).filter(Boolean))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds as string[] } },
            select: { id: true, name: true }
        });
        const userMap = new Map(users.map(u => [u.id, u.name]));

        // Group readings by date (dates are saved as 00:00:00Z representing Bangkok date)
        const readingsByDate = new Map<string, typeof readings>();

        for (const r of readings) {
            // Use date directly - dates are stored as 00:00:00Z which represents Bangkok date
            const dateKey = r.date.toISOString().split('T')[0];

            if (!readingsByDate.has(dateKey)) {
                readingsByDate.set(dateKey, []);
            }
            readingsByDate.get(dateKey)!.push(r);
        }

        // Calculate daily summaries
        const TANK_CAPACITY = 2400; // liters per tank
        const TOTAL_CAPACITY = TANK_CAPACITY * 3; // 7200 liters

        const dailySummaries = Array.from(readingsByDate.entries())
            .map(([dateKey, dayReadings]) => {
                // Get end percentages for each tank (latest readings with type='end')
                const tankReadings: Record<number, number[]> = { 1: [], 2: [], 3: [] };

                for (const r of dayReadings) {
                    if (tankReadings[r.tankNumber]) {
                        tankReadings[r.tankNumber].push(Number(r.percentage));
                    }
                }

                // Calculate average percentage per tank (or take latest)
                const tank1Pct = tankReadings[1].length > 0 ? tankReadings[1][0] : null;
                const tank2Pct = tankReadings[2].length > 0 ? tankReadings[2][0] : null;
                const tank3Pct = tankReadings[3].length > 0 ? tankReadings[3][0] : null;

                // Calculate total percentage (average of available tanks)
                const validTanks = [tank1Pct, tank2Pct, tank3Pct].filter(p => p !== null) as number[];
                const avgPercentage = validTanks.length > 0
                    ? validTanks.reduce((a, b) => a + b, 0) / validTanks.length
                    : 0;

                // Total liters estimated
                const totalLiters = (avgPercentage / 100) * TOTAL_CAPACITY;

                // Get recorder name from latest reading
                const latestReading = dayReadings[0];
                const recordedBy = latestReading?.recordedById
                    ? userMap.get(latestReading.recordedById) || 'Unknown'
                    : 'ระบบ';

                return {
                    id: `${stationId}-${dateKey}`,
                    date: dateKey + 'T00:00:00.000Z',
                    percentage: Math.round(avgPercentage * 10) / 10,
                    liters: Math.round(totalLiters),
                    tank1: tank1Pct,
                    tank2: tank2Pct,
                    tank3: tank3Pct,
                    readingsCount: dayReadings.length,
                    recordedBy,
                    createdAt: latestReading.createdAt.toISOString()
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ readings: dailySummaries });
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
