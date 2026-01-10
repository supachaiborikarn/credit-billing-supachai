import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getTodayBangkok, bangkokDateToUTC, resolveGasStation, getNonGasStationError } from '@/lib/gas';

/**
 * POST /api/v2/gas/[stationId]/shift/open
 * Open a new shift with mandatory meter and gauge readings (GAS stations only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }

        const body = await request.json();
        const { dateKey, shiftNumber, meters, gauges } = body;

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId: string | null = null;

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });
            userId = session?.userId || null;
        }

        // Validate inputs
        if (!dateKey || !shiftNumber) {
            return NextResponse.json({ error: 'dateKey and shiftNumber are required' }, { status: 400 });
        }

        if (!meters || meters.length < 4) {
            return NextResponse.json({ error: 'Meter readings for 4 nozzles are required' }, { status: 400 });
        }

        if (!gauges || gauges.length < 3) {
            return NextResponse.json({ error: 'Gauge readings for 3 tanks are required' }, { status: 400 });
        }

        // Get or create DailyRecord (use station.dbId)
        const dateUTC = bangkokDateToUTC(dateKey);
        let dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.dbId,
                date: dateUTC
            }
        });

        if (!dailyRecord) {
            // Default gas price (ideally would come from settings)
            const gasPrice = 16.09;

            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.dbId,
                    date: dateUTC,
                    gasPrice,
                    retailPrice: gasPrice,
                    wholesalePrice: gasPrice
                }
            });
        }

        // Check no open shift exists
        const existingOpenShift = await prisma.shift.findFirst({
            where: {
                dailyRecordId: dailyRecord.id,
                status: 'OPEN'
            }
        });

        if (existingOpenShift) {
            return NextResponse.json({ error: 'มีกะที่เปิดอยู่แล้ว' }, { status: 400 });
        }

        // Create shift
        const shift = await prisma.shift.create({
            data: {
                dailyRecordId: dailyRecord.id,
                shiftNumber,
                staffId: userId,
                status: 'OPEN'
            }
        });

        // Create meter readings
        for (const meter of meters) {
            await prisma.meterReading.create({
                data: {
                    shiftId: shift.id,
                    dailyRecordId: dailyRecord.id,
                    nozzleNumber: meter.nozzleNumber,
                    startReading: meter.reading,
                    startPhoto: meter.photoUrl || null
                }
            });
        }

        // Create gauge readings
        for (const gauge of gauges) {
            await prisma.gaugeReading.create({
                data: {
                    stationId: station.dbId,
                    dailyRecordId: dailyRecord.id,
                    date: new Date(),
                    tankNumber: gauge.tankNumber,
                    percentage: gauge.percentage,
                    shiftNumber,
                    notes: 'start'
                }
            });
        }

        return NextResponse.json({
            success: true,
            shiftId: shift.id,
            message: 'เปิดกะสำเร็จ'
        });
    } catch (error) {
        console.error('[Shift Open]:', error);
        return NextResponse.json({ error: 'Failed to open shift' }, { status: 500 });
    }
}
