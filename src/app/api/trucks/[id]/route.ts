import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { licensePlate, ownerId } = body;

        if (!ownerId) {
            return NextResponse.json({ error: 'กรุณาระบุเจ้าของรถ' }, { status: 400 });
        }

        // Check if owner exists
        const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
        if (!owner) {
            return NextResponse.json({ error: 'ไม่พบเจ้าของรถ' }, { status: 404 });
        }

        // If licensePlate is being changed, check for duplicates
        if (licensePlate) {
            const existingTruck = await prisma.truck.findFirst({
                where: {
                    licensePlate: licensePlate.toUpperCase(),
                    id: { not: id } // Exclude current truck
                }
            });
            if (existingTruck) {
                return NextResponse.json({ error: 'ทะเบียนรถนี้มีในระบบแล้ว' }, { status: 400 });
            }
        }

        // Update truck
        const updatedTruck = await prisma.truck.update({
            where: { id },
            data: {
                ownerId,
                ...(licensePlate && { licensePlate: licensePlate.toUpperCase() })
            },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        return NextResponse.json(updatedTruck);
    } catch (error) {
        console.error('Error updating truck:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดต' }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const truck = await prisma.truck.findUnique({
            where: { id },
            include: {
                owner: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        if (!truck) {
            return NextResponse.json({ error: 'ไม่พบรถ' }, { status: 404 });
        }

        return NextResponse.json(truck);
    } catch (error) {
        console.error('Error fetching truck:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}
