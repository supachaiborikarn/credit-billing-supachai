import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        // Get daily record with meters
        const dailyRecord = await prisma.dailyRecord.findUnique({
            where: {
                stationId_date: { stationId, date }
            },
            include: { meters: true }
        });

        // Get transactions for the day
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const transactions = await prisma.transaction.findMany({
            where: {
                stationId,
                date: { gte: startOfDay, lte: endOfDay }
            },
            orderBy: { date: 'asc' },
            include: {
                owner: { select: { name: true, code: true } },
                truck: { select: { licensePlate: true } },
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

        return NextResponse.json({
            dailyRecord: dailyRecord ? {
                ...dailyRecord,
                retailPrice: Number(dailyRecord.retailPrice),
                wholesalePrice: Number(dailyRecord.wholesalePrice),
            } : null,
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.date.toISOString(),
                licensePlate: t.licensePlate || t.truck?.licensePlate || '',
                ownerName: t.ownerName || t.owner?.name || '',
                paymentType: t.paymentType,
                nozzleNumber: t.nozzleNumber,
                liters: Number(t.liters),
                pricePerLiter: Number(t.pricePerLiter),
                amount: Number(t.amount),
                recordedByName: t.recordedBy?.name || '-',
            })),
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

        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

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
