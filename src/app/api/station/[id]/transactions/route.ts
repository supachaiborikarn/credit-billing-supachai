import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
        const {
            date: dateStr,
            licensePlate,
            ownerName,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            billBookNo,
            billNo,
            productType,
        } = body;

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId = 'unknown';

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { userId: true }
            });
            if (session) userId = session.userId;
        }

        // Get or create daily record for FULL station
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        let dailyRecordId = null;
        const station = await prisma.station.findUnique({ where: { id: stationId } });

        if (station?.type === 'FULL') {
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
            dailyRecordId = dailyRecord.id;
        }

        // Find owner by name if credit
        let ownerId = null;
        if (paymentType === 'CREDIT' && ownerName) {
            const owner = await prisma.owner.findFirst({
                where: { name: { contains: ownerName } }
            });
            if (owner) ownerId = owner.id;
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId,
                dailyRecordId,
                date: new Date(),
                licensePlate,
                ownerName,
                ownerId,
                paymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                billBookNo,
                billNo,
                productType,
                recordedById: userId,
            }
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('Transaction POST error:', error);
        return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
    }
}
