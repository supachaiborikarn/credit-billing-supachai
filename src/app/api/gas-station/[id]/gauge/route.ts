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
        const shiftStr = searchParams.get('shift');
        const shiftNumber = shiftStr ? parseInt(shiftStr) : 0;

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

        // Get all readings for the day AND shift
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId: station.id,
                date: { gte: startOfDay, lte: endOfDay },
                shiftNumber: shiftNumber
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by tankNumber and type (start/end from notes field)
        const readingsByTank: Record<number, { start?: typeof gaugeReadings[0], end?: typeof gaugeReadings[0] }> = {};

        gaugeReadings.forEach(g => {
            if (!readingsByTank[g.tankNumber]) {
                readingsByTank[g.tankNumber] = {};
            }
            // Type is stored in notes field: 'start' or 'end'
            const type = g.notes === 'start' ? 'start' : (g.notes === 'end' ? 'end' : null);
            if (type && !readingsByTank[g.tankNumber][type]) {
                readingsByTank[g.tankNumber][type] = g;
            }
        });

        // Return array of 3 tanks with start/end percentages
        const result = [1, 2, 3].map(tankNum => {
            const readings = readingsByTank[tankNum];
            return {
                tankNumber: tankNum,
                startPercentage: readings?.start ? Number(readings.start.percentage) : null,
                endPercentage: readings?.end ? Number(readings.end.percentage) : null,
                startPhoto: readings?.start?.photoUrl || null,
                endPhoto: readings?.end?.photoUrl || null,
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Gauge reading GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch gauge readings' }, { status: 500 });
    }
}

// POST - save a new gauge reading for a tank (start or end)
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
        const { date: dateStr, tankNumber, percentage, type, photoUrl, shiftNumber = 0 } = body;

        if (!tankNumber || tankNumber < 1 || tankNumber > 3) {
            return NextResponse.json({ error: 'ถังต้องเป็น 1, 2 หรือ 3' }, { status: 400 });
        }

        if (percentage === undefined || percentage < 0 || percentage > 100) {
            return NextResponse.json({ error: 'เปอร์เซนต์ต้องอยู่ระหว่าง 0-100' }, { status: 400 });
        }

        if (!type || (type !== 'start' && type !== 'end')) {
            return NextResponse.json({ error: 'ต้องระบุประเภท start หรือ end' }, { status: 400 });
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
                    gasPrice: 16.09,
                }
            });
        }

        // Delete existing reading for same tank + type on this day + shift (update)
        await prisma.gaugeReading.deleteMany({
            where: {
                stationId: station.id,
                dailyRecordId: dailyRecord.id,
                tankNumber,
                notes: type, // 'start' or 'end'
                shiftNumber: shiftNumber,
            }
        });

        // Create new gauge reading with type stored in notes
        const gaugeReading = await prisma.gaugeReading.create({
            data: {
                stationId: station.id,
                dailyRecordId: dailyRecord.id,
                tankNumber,
                date: new Date(),
                percentage,
                photoUrl: photoUrl || null,
                notes: type, // Store 'start' or 'end' in notes field
                shiftNumber: shiftNumber,
            }
        });

        return NextResponse.json({
            ...gaugeReading,
            percentage: Number(gaugeReading.percentage),
            type: type
        });
    } catch (error) {
        console.error('Gauge reading POST error:', error);
        return NextResponse.json({ error: 'Failed to save gauge reading' }, { status: 500 });
    }
}

