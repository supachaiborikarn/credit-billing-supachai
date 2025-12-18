import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok } from '@/lib/date-utils';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
        const { date: dateStr, type, meters } = body;

        const date = getStartOfDayBangkok(dateStr);

        // Get or create daily record
        const dailyRecord = await prisma.dailyRecord.upsert({
            where: { stationId_date: { stationId, date } },
            update: {},
            create: {
                stationId,
                date,
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                status: 'OPEN',
            }
        });

        // Update meter readings
        for (const meter of meters) {
            await prisma.meterReading.upsert({
                where: {
                    dailyRecordId_nozzleNumber: {
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: meter.nozzleNumber,
                    }
                },
                update: type === 'start'
                    ? { startReading: meter.reading }
                    : { endReading: meter.reading },
                create: {
                    dailyRecordId: dailyRecord.id,
                    nozzleNumber: meter.nozzleNumber,
                    startReading: type === 'start' ? meter.reading : 0,
                    endReading: type === 'end' ? meter.reading : null,
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save meters' }, { status: 500 });
    }
}
