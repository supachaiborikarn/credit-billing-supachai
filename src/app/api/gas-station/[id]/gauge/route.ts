import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

// GET - fetch gauge readings for a date
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date');

        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig || stationConfig.type !== 'GAS') {
            return NextResponse.json({ error: 'Gas station not found' }, { status: 404 });
        }

        const station = await prisma.station.findFirst({
            where: { name: stationConfig.name }
        });

        if (!station) {
            return NextResponse.json([]);
        }

        const date = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get latest reading for each tank
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.id,
                date: { gte: startOfDay, lte: endOfDay }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by tankNumber and get latest for each
        const latestByTank: Record<number, typeof gaugeReadings[0]> = {};
        gaugeReadings.forEach(g => {
            if (!latestByTank[g.tankNumber]) {
                latestByTank[g.tankNumber] = g;
            }
        });

        // Return array of 3 tanks with latest readings
        const result = [1, 2, 3].map(tankNum => {
            const reading = latestByTank[tankNum];
            return {
                tankNumber: tankNum,
                percentage: reading ? Number(reading.percentage) : null,
                photoUrl: reading?.photoUrl || null,
                createdAt: reading?.createdAt || null,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Gauge reading GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}

// POST - save a new gauge reading for a tank
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig || stationConfig.type !== 'GAS') {
            return NextResponse.json({ error: 'Gas station not found' }, { status: 404 });
        }

        const body = await request.json();
        const { date: dateStr, tankNumber, percentage, photoUrl, notes } = body;

        if (!tankNumber || tankNumber < 1 || tankNumber > 3) {
            return NextResponse.json({ error: 'ถังต้องเป็น 1, 2 หรือ 3' }, { status: 400 });
        }

        if (percentage === undefined || percentage < 0 || percentage > 100) {
            return NextResponse.json({ error: 'เปอร์เซนต์ต้องอยู่ระหว่าง 0-100' }, { status: 400 });
        }

        // Get or create station
        let station = await prisma.station.findFirst({
            where: { name: stationConfig.name }
        });

        if (!station) {
            station = await prisma.station.create({
                data: {
                    name: stationConfig.name,
                    type: 'GAS',
                }
            });
        }

        const date = new Date(dateStr + 'T00:00:00Z');

        // Get or create daily record
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date
            }
        });

        if (!dailyRecord) {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.id,
                    date: date,
                    gasPrice: 15.50,
                }
            });
        }

        // Create gauge reading
        const gaugeReading = await prisma.gaugeReading.create({
            data: {
                stationId: station.id,
                dailyRecordId: dailyRecord.id,
                tankNumber,
                date: new Date(),
                percentage,
                photoUrl: photoUrl || null,
                notes: notes || null,
            }
        });

        return NextResponse.json({
            ...gaugeReading,
            percentage: Number(gaugeReading.percentage)
        });
    } catch (error) {
        console.error('Gauge reading POST error:', error);
        return NextResponse.json({ error: 'Failed to save gauge reading' }, { status: 500 });
    }
}
