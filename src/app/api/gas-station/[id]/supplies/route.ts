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

        const supplies = await prisma.gasSupply.findMany({
            where: { stationId: station.id },
            orderBy: { date: 'desc' },
            take: 50
        });

        return NextResponse.json(supplies.map(s => ({
            ...s,
            liters: Number(s.liters),
            pricePerLiter: s.pricePerLiter ? Number(s.pricePerLiter) : null,
            totalCost: s.totalCost ? Number(s.totalCost) : null,
        })));
    } catch (error) {
        console.error('Gas supplies GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch supplies' }, { status: 500 });
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
        const { date: dateStr, liters, supplier, invoiceNo, pricePerLiter } = body;

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

        const supply = await prisma.gasSupply.create({
            data: {
                stationId: station.id,
                date: new Date(dateStr + 'T00:00:00Z'),
                liters,
                supplier: supplier || null,
                invoiceNo: invoiceNo || null,
                pricePerLiter: pricePerLiter || null,
                totalCost: pricePerLiter ? liters * pricePerLiter : null,
            }
        });

        return NextResponse.json({
            ...supply,
            liters: Number(supply.liters),
        });
    } catch (error) {
        console.error('Gas supply POST error:', error);
        return NextResponse.json({ error: 'Failed to add supply' }, { status: 500 });
    }
}
