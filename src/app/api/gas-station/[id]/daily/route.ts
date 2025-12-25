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
        const shiftStr = url.searchParams.get('shift');
        const shiftNumber = shiftStr ? parseInt(shiftStr) : null;
        const date = new Date(dateStr + 'T00:00:00Z');

        // Get or create station with consistent ID
        const stationId = `station-${id}`;
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

        // Get daily record with shifts
        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId: station.id,
                date: date,
            },
            include: {
                meters: true,
                shifts: {
                    include: {
                        meters: true,
                        staff: { select: { name: true } }
                    },
                    orderBy: { shiftNumber: 'asc' }
                }
            }
        });

        // Get transactions for the day (filtered by shift if specified)
        const startOfDay = new Date(dateStr + 'T00:00:00Z');
        const endOfDay = new Date(dateStr + 'T23:59:59Z');

        const transactionWhere: Record<string, unknown> = {
            stationId: station.id,
            deletedAt: null,
            date: {
                gte: startOfDay,
                lte: endOfDay,
            }
        };

        // If shift is specified, filter by shiftNumber
        if (shiftNumber !== null) {
            transactionWhere.shiftNumber = shiftNumber;
        }

        const transactions = await prisma.transaction.findMany({
            where: transactionWhere,
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

        // Get gauge readings for the shift (if specified)
        const gaugeWhere: Record<string, unknown> = {
            stationId: station.id,
            date: { gte: startOfDay, lte: endOfDay }
        };
        if (shiftNumber !== null) {
            gaugeWhere.shiftNumber = shiftNumber;
        }

        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: gaugeWhere,
            orderBy: { createdAt: 'desc' }
        });

        // Calculate current stock from gauge readings
        // Formula: (Tank1% + Tank2% + Tank3%) × 98 liters per percent
        const LITERS_PER_PERCENT = 98;

        // Get latest reading for each tank
        let currentStock = 0;
        if (gaugeReadings.length > 0) {
            const latestByTank: Record<number, number> = {};
            for (const g of gaugeReadings) {
                if (!latestByTank[g.tankNumber]) {
                    latestByTank[g.tankNumber] = Number(g.percentage);
                }
            }
            // Sum all tank percentages and multiply by liters per percent
            const totalPercentage = Object.values(latestByTank).reduce((sum, p) => sum + p, 0);
            currentStock = totalPercentage * LITERS_PER_PERCENT;
        }

        // Get shift-specific data if shift is specified
        const currentShiftData = shiftNumber !== null && dailyRecord?.shifts
            ? dailyRecord.shifts.find(s => s.shiftNumber === shiftNumber)
            : null;

        return NextResponse.json({
            station,
            dailyRecord: dailyRecord ? {
                ...dailyRecord,
                gasPrice: Number(dailyRecord.gasPrice) || station.gasPrice || 15.50,
            } : null,
            currentShift: currentShiftData ? {
                id: currentShiftData.id,
                shiftNumber: currentShiftData.shiftNumber,
                status: currentShiftData.status,
                meters: currentShiftData.meters,
                staffName: currentShiftData.staff?.name,
                openingStock: currentShiftData.openingStock,
                closingStock: currentShiftData.closingStock,
                carryOverFromShiftId: currentShiftData.carryOverFromShiftId,
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
            gaugeReadings: gaugeReadings.map(g => ({
                ...g,
                percentage: Number(g.percentage),
            })),
            currentStock,
            shiftFilter: shiftNumber,
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

        // Get or create station with consistent ID
        const stationId = `station-${id}`;
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: 'GAS',
                gasPrice: gasPrice || 15.50,
                gasStockAlert: 1000,
            }
        });

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
