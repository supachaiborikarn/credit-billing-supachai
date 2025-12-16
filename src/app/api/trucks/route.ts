import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const trucks = await prisma.truck.findMany({
            orderBy: { licensePlate: 'asc' },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        return NextResponse.json(trucks);
    } catch (error) {
        console.error('Trucks GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch trucks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { licensePlate, ownerId } = body;

        if (!licensePlate || !ownerId) {
            return NextResponse.json({ error: 'กรุณากรอกทะเบียนรถและเลือกเจ้าของ' }, { status: 400 });
        }

        // Check if license plate already exists
        const existing = await prisma.truck.findFirst({
            where: { licensePlate: licensePlate.toUpperCase() }
        });

        if (existing) {
            return NextResponse.json({ error: 'ทะเบียนรถนี้มีในระบบแล้ว' }, { status: 400 });
        }

        const truck = await prisma.truck.create({
            data: {
                licensePlate: licensePlate.toUpperCase(),
                ownerId,
            },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        return NextResponse.json(truck);
    } catch (error) {
        console.error('Truck POST error:', error);
        return NextResponse.json({ error: 'Failed to create truck' }, { status: 500 });
    }
}
