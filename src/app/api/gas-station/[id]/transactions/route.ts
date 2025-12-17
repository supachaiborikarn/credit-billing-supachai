import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { cookies } from 'next/headers';

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

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: true }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session ไม่ถูกต้อง' }, { status: 401 });
        }

        // Check session expiry
        if (session.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
        }

        const body = await request.json();
        const {
            date: dateStr,
            licensePlate,
            ownerName,
            ownerId,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            productType
        } = body;

        // Get or create station with STANDARD ID
        const stationId = `station-${id}`;
        let station = await prisma.station.findUnique({
            where: { id: stationId }
        });

        if (!station) {
            station = await prisma.station.create({
                data: {
                    id: stationId, // Use standard ID format
                    name: stationConfig.name,
                    type: 'GAS',
                    gasPrice: pricePerLiter || 15.50,
                    gasStockAlert: 1000,
                }
            });
        }

        // Get or create daily record
        const date = new Date(dateStr + 'T00:00:00Z');
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
                    gasPrice: pricePerLiter,
                    retailPrice: 0,
                    wholesalePrice: 0,
                }
            });
        }

        // Find truck if license plate provided
        let truckId = null;
        if (licensePlate) {
            const truck = await prisma.truck.findFirst({
                where: {
                    licensePlate: licensePlate.toUpperCase()
                }
            });
            if (truck) {
                truckId = truck.id;
            }
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId: station.id,
                dailyRecordId: dailyRecord.id,
                date: new Date(),
                truckId,
                licensePlate: licensePlate?.toUpperCase() || null,
                ownerId: ownerId || null,
                ownerName: ownerName || null,
                paymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                productType: productType || 'LPG',
                recordedById: session.user.id,
            }
        });

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Gas station transaction POST error:', error);
        return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
    }
}
