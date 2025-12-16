import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

export async function GET(
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

        const url = new URL(request.url);
        const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const date = new Date(dateStr + 'T00:00:00Z');

        // Get or find station
        let station = await prisma.station.findFirst({
            where: { name: stationConfig.name }
        });

        if (!station) {
            // Create station if not exists
            station = await prisma.station.create({
                data: {
                    name: stationConfig.name,
                    type: 'GAS',
                    gasPrice: 15.50,
                    gasStockAlert: 1000,
                }
            });
        }

        // Get daily record
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date,
            },
            include: {
                meters: true,
            }
        });

        // Get transactions for the day
        const startOfDay = new Date(dateStr + 'T00:00:00Z');
        const endOfDay = new Date(dateStr + 'T23:59:59Z');

        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: station.id,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                }
            },
            orderBy: { date: 'asc' },
            include: {
                owner: {
                    select: { name: true }
                }
            }
        });

        // Get gas supplies for the day
        const gasSupplies = await prisma.gasSupply.findMany({
            where: {
                stationId: station.id,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                }
            },
            orderBy: { date: 'desc' }
        });

        // Calculate current stock
        // Stock = Total supplies - Total sales (from all time)
        const totalSupplies = await prisma.gasSupply.aggregate({
            where: { stationId: station.id },
            _sum: { liters: true }
        });

        const totalSales = await prisma.transaction.aggregate({
            where: {
                stationId: station.id,
                productType: 'LPG'
            },
            _sum: { liters: true }
        });

        const currentStock = Number(totalSupplies._sum.liters || 0) - Number(totalSales._sum.liters || 0);

        return NextResponse.json({
            station,
            dailyRecord: dailyRecord ? {
                ...dailyRecord,
                gasPrice: Number(dailyRecord.gasPrice) || station.gasPrice || 15.50,
            } : null,
            transactions: transactions.map(t => ({
                ...t,
                ownerName: t.owner?.name || t.ownerName,
                liters: Number(t.liters),
                pricePerLiter: Number(t.pricePerLiter),
                amount: Number(t.amount),
            })),
            gasSupplies: gasSupplies.map(s => ({
                ...s,
                liters: Number(s.liters),
            })),
            currentStock,
        });
    } catch (error) {
        console.error('Gas station daily GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

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
        const { date: dateStr, gasPrice } = body;
        const date = new Date(dateStr + 'T00:00:00Z');

        // Get or create station
        let station = await prisma.station.findFirst({
            where: { name: stationConfig.name }
        });

        if (!station) {
            station = await prisma.station.create({
                data: {
                    name: stationConfig.name,
                    type: 'GAS',
                    gasPrice: gasPrice || 15.50,
                    gasStockAlert: 1000,
                }
            });
        }

        // Create or update daily record
        const existingRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date,
            }
        });

        let dailyRecord;
        if (existingRecord) {
            dailyRecord = await prisma.dailyRecord.update({
                where: { id: existingRecord.id },
                data: { gasPrice: gasPrice }
            });
        } else {
            dailyRecord = await prisma.dailyRecord.create({
                data: {
                    stationId: station.id,
                    date: date,
                    gasPrice: gasPrice,
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

        return NextResponse.json({ success: true, dailyRecord });
    } catch (error) {
        console.error('Gas station daily POST error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
