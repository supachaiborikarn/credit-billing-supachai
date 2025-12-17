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
            transferProofUrl,
        } = body;

        // Get user from session - REQUIRE authentication
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true, expiresAt: true }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session ไม่ถูกต้อง' }, { status: 401 });
        }

        // Check session expiry
        if (session.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
        }

        const userId = session.userId;

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

        // Check for duplicates (same station, date, plate, amount, type)
        // Helps prevent double-entry when importing data
        const startOfDay = new Date(dateStr + 'T00:00:00');
        const endOfDay = new Date(dateStr + 'T23:59:59.999');

        const duplicate = await prisma.transaction.findFirst({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                amount: amount,
                paymentType: paymentType,
                // Only check plate/owner if provided to avoid false positives on anonymous cash
                OR: [
                    licensePlate ? { licensePlate: licensePlate } : {},
                    ownerName ? { ownerName: ownerName } : {}
                ]
            }
        });

        if (duplicate) {
            return NextResponse.json({
                error: `รายการซ้ำ: พบรายการ ${paymentType} ยอด ${amount} บาท ของ ${licensePlate || ownerName || 'ไม่ระบุ'} ในวันที่ ${dateStr} แล้ว`
            }, { status: 409 });
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId,
                dailyRecordId,
                date: new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)), // Use selected date with current time
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
                transferProofUrl,
                recordedById: userId,
            }
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('Transaction POST error:', error);
        return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
    }
}
