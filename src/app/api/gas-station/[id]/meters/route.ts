import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

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
        const { date: dateStr, type, meters } = body;
        const date = new Date(dateStr + 'T00:00:00Z');

        // Get station
        const station = await prisma.station.findFirst({
            where: { name: stationConfig.name }
        });

        if (!station) {
            return NextResponse.json({ error: 'Station not found' }, { status: 404 });
        }

        // Get or create daily record
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date,
            }
        });

        if (!dailyRecord) {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.id,
                    date: date,
                    gasPrice: station.gasPrice || 15.50,
                    retailPrice: 0,
                    wholesalePrice: 0,
                }
            });

            // Create default meter readings
            for (let i = 1; i <= 4; i++) {
                await prisma.meterReading.create({
                    data: {
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: i,
                        startReading: 0,
                    }
                });
            }
        }

        // Update meter readings
        for (const meter of meters) {
            const existingMeter = await prisma.meterReading.findFirst({
                where: {
                    dailyRecordId: dailyRecord.id,
                    nozzleNumber: meter.nozzleNumber,
                }
            });

            if (existingMeter) {
                await prisma.meterReading.update({
                    where: { id: existingMeter.id },
                    data: type === 'start'
                        ? { startReading: meter.reading }
                        : { endReading: meter.reading }
                });
            } else {
                await prisma.meterReading.create({
                    data: {
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: meter.nozzleNumber,
                        startReading: type === 'start' ? meter.reading : 0,
                        endReading: type === 'end' ? meter.reading : null,
                    }
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Gas station meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save meters' }, { status: 500 });
    }
}
