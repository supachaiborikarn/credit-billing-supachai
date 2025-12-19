import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { buildTruckCodeMap, findCodeByPlate } from '@/lib/truck-utils';
import { cookies } from 'next/headers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();

        // Parse date using Bangkok timezone utilities
        const date = getStartOfDayBangkok(dateStr);

        // Get user from session (for filtering)
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;
        let userId: string | null = null;
        let userRole: string = 'STAFF';

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { user: { select: { id: true, role: true } } }
            });
            if (session?.user) {
                userId = session.user.id;
                userRole = session.user.role;
            }
        }

        // Get daily record with meters
        const dailyRecord = await prisma.dailyRecord.findUnique({
            where: {
                stationId_date: { stationId, date }
            },
            include: { meters: true }
        });

        // Get transactions for the day (Bangkok timezone range)
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Build where clause
        // FULL station (id=1): Everyone sees all (staff work together)
        // SIMPLE/GAS stations: Staff sees only their own
        const whereClause: Record<string, unknown> = {
            stationId,
            date: { gte: startOfDay, lte: endOfDay }
        };

        // Only filter by recordedById for non-FULL stations
        const isFullStation = id === '1';
        if (userRole === 'STAFF' && userId && !isFullStation) {
            whereClause.recordedById = userId;
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            orderBy: { date: 'asc' },
            include: {
                owner: { select: { name: true, code: true } },
                truck: { select: { licensePlate: true, code: true } },
                recordedBy: { select: { name: true } }
            }
        });

        // Get previous day's meters for continuity check
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);

        const previousDayRecord = await prisma.dailyRecord.findUnique({
            where: {
                stationId_date: { stationId, date: prevDate }
            },
            include: { meters: true }
        });

        const previousDayMeters = previousDayRecord?.meters?.map((m: { nozzleNumber: number; endReading: unknown }) => ({
            nozzle: m.nozzleNumber,
            endReading: Number(m.endReading) || 0
        })) || [];

        // Build truck code map for C-Code lookup
        const truckCodeMap = await buildTruckCodeMap();

        return NextResponse.json({
            dailyRecord: dailyRecord ? {
                id: dailyRecord.id,
                stationId: dailyRecord.stationId,
                date: dailyRecord.date,
                status: dailyRecord.status,
                retailPrice: Number(dailyRecord.retailPrice),
                wholesalePrice: Number(dailyRecord.wholesalePrice),
                meters: dailyRecord.meters.map(m => ({
                    id: m.id,
                    nozzleNumber: m.nozzleNumber,
                    startReading: Number(m.startReading),
                    endReading: Number(m.endReading) || 0,
                    startPhoto: m.startPhoto,
                    endPhoto: m.endPhoto,
                })),
            } : null,
            transactions: transactions.map(t => {
                const plate = t.licensePlate || t.truck?.licensePlate || '';
                return {
                    id: t.id,
                    date: t.date.toISOString(),
                    licensePlate: plate,
                    ownerName: t.owner?.name || t.ownerName || '',
                    ownerCode: t.truck?.code || findCodeByPlate(plate, truckCodeMap) || t.owner?.code || null,
                    paymentType: t.paymentType,
                    nozzleNumber: t.nozzleNumber,
                    liters: Number(t.liters),
                    pricePerLiter: Number(t.pricePerLiter),
                    amount: Number(t.amount),
                    billBookNo: t.billBookNo || null,
                    billNo: t.billNo || null,
                    recordedByName: t.recordedBy?.name || '-',
                    transferProofUrl: t.transferProofUrl || null,
                };
            }),
            previousDayMeters,
        });
    } catch (error) {
        console.error('Station daily GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
        const { date: dateStr, retailPrice, wholesalePrice } = body;

        const date = getStartOfDayBangkok(dateStr);

        // Upsert daily record
        const dailyRecord = await prisma.dailyRecord.upsert({
            where: {
                stationId_date: { stationId, date }
            },
            update: {
                retailPrice,
                wholesalePrice,
            },
            create: {
                stationId,
                date,
                retailPrice,
                wholesalePrice,
                status: 'OPEN',
            }
        });

        // Create meter readings if not exist
        const existingMeters = await prisma.meterReading.count({
            where: { dailyRecordId: dailyRecord.id }
        });

        if (existingMeters === 0) {
            await prisma.meterReading.createMany({
                data: [1, 2, 3, 4].map(nozzleNumber => ({
                    dailyRecordId: dailyRecord.id,
                    nozzleNumber,
                    startReading: 0,
                }))
            });
        }

        return NextResponse.json({ success: true, dailyRecord });
    } catch (error) {
        console.error('Station daily POST error:', error);
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
}
