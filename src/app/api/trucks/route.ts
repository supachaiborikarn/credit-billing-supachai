import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';

interface TruckInput {
    licensePlate: string;
    ownerId?: string;
    ownerName?: string; // Support creating new owner
}

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
        console.error('[Trucks GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Handle single truck with ownerName (from simple-station sell page)
        if (body.licensePlate && body.ownerName && !body.ownerId) {
            const licensePlate = body.licensePlate.trim().toUpperCase();
            const ownerName = body.ownerName.trim();

            // Check if truck already exists
            const existingTruck = await prisma.truck.findFirst({
                where: { licensePlate },
            });

            if (existingTruck) {
                return HttpErrors.conflict(`ทะเบียน ${licensePlate} มีในระบบแล้ว`);
            }

            // Find or create owner by name
            let owner = await prisma.owner.findFirst({
                where: { name: ownerName },
            });

            if (!owner) {
                // Create new owner with auto-generated code
                const count = await prisma.owner.count();
                const code = `C${String(count + 1).padStart(4, '0')}`;
                owner = await prisma.owner.create({
                    data: { name: ownerName, code },
                });
            }

            // Create truck
            const truck = await prisma.truck.create({
                data: {
                    licensePlate,
                    ownerId: owner.id,
                },
                include: {
                    owner: { select: { id: true, name: true, code: true } }
                }
            });

            return NextResponse.json({ ...truck, ownerId: owner.id });
        }

        // Original logic for bulk create with ownerId
        const trucksToCreate: TruckInput[] = Array.isArray(body) ? body : [body];

        if (trucksToCreate.length === 0) {
            return HttpErrors.badRequest('กรุณาเพิ่มรถอย่างน้อย 1 คัน');
        }

        // Validate all trucks
        for (const truck of trucksToCreate) {
            if (!truck.licensePlate || !truck.ownerId) {
                return HttpErrors.badRequest('กรุณากรอกทะเบียนรถและเลือกเจ้าของ');
            }
        }

        // Check for duplicate license plates in the request
        const licensePlates = trucksToCreate.map(t => t.licensePlate.toUpperCase());
        const uniquePlates = new Set(licensePlates);
        if (licensePlates.length !== uniquePlates.size) {
            return HttpErrors.badRequest('มีทะเบียนรถซ้ำกันในรายการที่เพิ่ม');
        }

        // Check if any license plate already exists in database
        const existing = await prisma.truck.findMany({
            where: { licensePlate: { in: licensePlates } },
            select: { licensePlate: true }
        });

        if (existing.length > 0) {
            const duplicates = existing.map(e => e.licensePlate).join(', ');
            return HttpErrors.conflict(`ทะเบียนรถนี้มีในระบบแล้ว: ${duplicates}`);
        }

        // Single truck - return the created truck with owner
        if (trucksToCreate.length === 1) {
            const truck = await prisma.truck.create({
                data: {
                    licensePlate: trucksToCreate[0].licensePlate.toUpperCase(),
                    ownerId: trucksToCreate[0].ownerId!,
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
                ownerId: t.ownerId!,
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
        console.error('[Truck POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

