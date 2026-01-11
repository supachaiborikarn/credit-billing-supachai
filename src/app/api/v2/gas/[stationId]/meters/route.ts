import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';

/**
 * POST /api/v2/gas/[stationId]/meters
 * Save meter readings for a shift
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

        const body = await request.json();
        const { shiftId, type, readings } = body;

        if (!shiftId || !type || !readings || !Array.isArray(readings)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate type
        if (type !== 'start' && type !== 'end') {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        // Get the shift and its daily record
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                dailyRecord: true,
                meters: true
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        // Process each reading
        const results = await Promise.all(
            readings.map(async (reading: { nozzleNumber: number; reading: number; photoUrl?: string }) => {
                const nozzleNumber = reading.nozzleNumber;
                const value = reading.reading;
                const photoUrl = reading.photoUrl || null;

                // Check if meter reading exists for this shift and nozzle
                const existingMeter = shift.meters.find(m => m.nozzleNumber === nozzleNumber);

                if (existingMeter) {
                    // Update existing meter reading
                    if (type === 'start') {
                        return prisma.meterReading.update({
                            where: { id: existingMeter.id },
                            data: {
                                startReading: value,
                                startPhoto: photoUrl
                            }
                        });
                    } else {
                        // End reading - also calculate sold quantity
                        const startReading = Number(existingMeter.startReading || 0);
                        const soldQty = value - startReading;

                        return prisma.meterReading.update({
                            where: { id: existingMeter.id },
                            data: {
                                endReading: value,
                                endPhoto: photoUrl,
                                soldQty: soldQty > 0 ? soldQty : 0
                            }
                        });
                    }
                } else {
                    // Create new meter reading
                    const data: {
                        dailyRecordId: string;
                        shiftId: string;
                        nozzleNumber: number;
                        startReading?: number;
                        endReading?: number;
                        soldQty?: number;
                        startPhoto?: string | null;
                        endPhoto?: string | null;
                        capturedById?: string | null;
                    } = {
                        dailyRecordId: shift.dailyRecordId,
                        shiftId: shiftId,
                        nozzleNumber: nozzleNumber,
                        capturedById: userId
                    };

                    if (type === 'start') {
                        data.startReading = value;
                        data.startPhoto = photoUrl;
                    } else {
                        data.endReading = value;
                        data.endPhoto = photoUrl;
                        data.soldQty = 0; // Can't calculate without start reading
                    }

                    return prisma.meterReading.create({ data });
                }
            })
        );

        // Log the action
        console.log(`[Meters] Saved ${type} readings for shift ${shiftId}: ${readings.length} nozzles by user ${userId}`);

        return NextResponse.json({
            success: true,
            count: results.length,
            type
        });
    } catch (error) {
        console.error('[Meters POST]:', error);
        return NextResponse.json({ error: 'Failed to save meter readings' }, { status: 500 });
    }
}

/**
 * GET /api/v2/gas/[stationId]/meters
 * Get meter readings for a shift
 */
export async function GET(
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

        const { searchParams } = new URL(request.url);
        const shiftId = searchParams.get('shiftId');

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId required' }, { status: 400 });
        }

        const meters = await prisma.meterReading.findMany({
            where: { shiftId },
            orderBy: { nozzleNumber: 'asc' }
        });

        return NextResponse.json({ meters });
    } catch (error) {
        console.error('[Meters GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch meter readings' }, { status: 500 });
    }
}
