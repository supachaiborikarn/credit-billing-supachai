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

        // Support both single truck and array of trucks
        const trucksToCreate = Array.isArray(body) ? body : [body];

        if (trucksToCreate.length === 0) {
            return NextResponse.json({ error: 'กรุณาเพิ่มรถอย่างน้อย 1 คัน' }, { status: 400 });
        }

        // Validate all trucks
        for (const truck of trucksToCreate) {
            if (!truck.licensePlate || !truck.ownerId) {
                return NextResponse.json({ error: 'กรุณากรอกทะเบียนรถและเลือกเจ้าของ' }, { status: 400 });
            }
        }

        // Check for duplicate license plates in the request
        const licensePlates = trucksToCreate.map(t => t.licensePlate.toUpperCase());
        const uniquePlates = new Set(licensePlates);
        if (licensePlates.length !== uniquePlates.size) {
            return NextResponse.json({ error: 'มีทะเบียนรถซ้ำกันในรายการที่เพิ่ม' }, { status: 400 });
        }

        // Check if any license plate already exists in database
        const existing = await prisma.truck.findMany({
            where: { licensePlate: { in: licensePlates } },
            select: { licensePlate: true }
        });

        if (existing.length > 0) {
            const duplicates = existing.map(e => e.licensePlate).join(', ');
            return NextResponse.json({ error: `ทะเบียนรถนี้มีในระบบแล้ว: ${duplicates}` }, { status: 400 });
        }

        // Single truck - return the created truck with owner
        if (trucksToCreate.length === 1) {
            const truck = await prisma.truck.create({
                data: {
                    licensePlate: trucksToCreate[0].licensePlate.toUpperCase(),
                    ownerId: trucksToCreate[0].ownerId,
                },
                include: {
                    owner: {
                        select: { id: true, name: true, code: true }
                    }
                }
            });
            return NextResponse.json(truck);
        }

        // Bulk create
        await prisma.truck.createMany({
            data: trucksToCreate.map(t => ({
                licensePlate: t.licensePlate.toUpperCase(),
                ownerId: t.ownerId,
            }))
        });

        // Fetch all created trucks with owner info
        const createdTrucks = await prisma.truck.findMany({
            where: { licensePlate: { in: licensePlates } },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        return NextResponse.json(createdTrucks);
    } catch (error) {
        console.error('Truck POST error:', error);
        return NextResponse.json({ error: 'Failed to create truck' }, { status: 500 });
    }
}
