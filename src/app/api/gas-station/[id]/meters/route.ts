import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getEndOfDayBangkokUTC, getStartOfDayBangkokUTC, getTodayBangkok } from '@/lib/gas/date-utils';
import { prepareMeterSaveData } from '@/services';
import { requireStationAccessApi } from '@/lib/api-auth';

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

        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { date: dateStr, type, meters, shiftId } = body;
        const userId = auth.user.id;
        const dateKey = dateStr || getTodayBangkok();
        const date = getStartOfDayBangkokUTC(dateKey);
        const endOfDay = getEndOfDayBangkokUTC(dateKey);

        // Get or create station with consistent ID
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: 'GAS',
                gasPrice: 15.50,
                gasStockAlert: 1000,
            }
        });

        // ===== SHIFT-BASED METER SAVING (NEW) =====
        if (shiftId) {
            // Verify shift exists
            const shift = await prisma.shift.findUnique({
                where: { id: shiftId },
                include: {
                    meters: true,
                    dailyRecord: { select: { stationId: true } }
                }
            });

            if (!shift) {
                return NextResponse.json({ error: 'ไม่พบกะนี้' }, { status: 404 });
            }

            if (shift.dailyRecord.stationId !== stationId) {
                return NextResponse.json({ error: 'ไม่พบกะนี้ในสถานีนี้' }, { status: 404 });
            }

            // Update shift's meter readings with auto-calculation
            const savedMeters = [];
            for (const meter of meters) {
                const existingMeter = shift.meters.find(m => m.nozzleNumber === meter.nozzleNumber);

                if (existingMeter) {
                    // Use service to prepare data with auto-calculation
                    const updateData = prepareMeterSaveData(
                        type,
                        meter.reading,
                        existingMeter.startReading ? Number(existingMeter.startReading) : null,
                        userId
                    );

                    await prisma.meterReading.update({
                        where: { id: existingMeter.id },
                        data: updateData
                    });

                    savedMeters.push({
                        nozzleNumber: meter.nozzleNumber,
                        ...updateData
                    });
                } else {
                    // Create new meter reading for this shift
                    const createData = prepareMeterSaveData(type, meter.reading, null, userId);

                    await prisma.meterReading.create({
                        data: {
                            dailyRecordId: shift.dailyRecordId,
                            shiftId: shiftId,
                            nozzleNumber: meter.nozzleNumber,
                            ...createData,
                        }
                    });
                }
            }

            return NextResponse.json({
                success: true,
                savedTo: 'shift',
                shiftId: shiftId,
                meters: savedMeters
            });
        }

        // ===== LEGACY: DAILY RECORD BASED (BACKWARD COMPATIBLE) =====
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: {
                    gte: date,
                    lte: endOfDay,
                },
            },
            orderBy: { date: 'asc' },
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

        // Update meter readings (legacy dailyRecord-based)
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

        return NextResponse.json({
            success: true,
            savedTo: 'dailyRecord',
            dailyRecordId: dailyRecord.id
        });
    } catch (error) {
        console.error('Gas station meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save meters' }, { status: 500 });
    }
}
