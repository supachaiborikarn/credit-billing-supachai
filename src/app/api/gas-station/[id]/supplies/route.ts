import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkokUTC } from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const station = await prisma.station.upsert({
            where: { id: auth.station.dbId },
            update: {},
            create: {
                id: auth.station.dbId,
                name: auth.station.name,
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
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { date: dateStr, liters, supplier, invoiceNo, pricePerLiter } = body;
        const litersNumber = Number(liters);
        const priceNumber = pricePerLiter ? Number(pricePerLiter) : null;

        if (!dateStr || !Number.isFinite(litersNumber) || litersNumber <= 0) {
            return NextResponse.json({ error: 'กรุณาระบุวันที่และจำนวนลิตรรับเข้า' }, { status: 400 });
        }

        // Get or create station with consistent ID
        const station = await prisma.station.upsert({
            where: { id: auth.station.dbId },
            update: {},
            create: {
                id: auth.station.dbId,
                name: auth.station.name,
                type: 'GAS',
                gasPrice: 15.50,
                gasStockAlert: 1000,
            }
        });

        const supply = await prisma.gasSupply.create({
            data: {
                stationId: station.id,
                date: getStartOfDayBangkokUTC(dateStr),
                liters: litersNumber,
                supplier: supplier || null,
                invoiceNo: invoiceNo || null,
                pricePerLiter: priceNumber,
                totalCost: priceNumber ? litersNumber * priceNumber : null,
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
