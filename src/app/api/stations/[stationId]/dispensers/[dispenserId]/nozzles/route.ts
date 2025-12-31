import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Create nozzle for dispenser
export async function POST(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const { dispenserId } = await params;
        const body = await request.json();
        const { code, productId } = body;

        if (!code || !productId) {
            return NextResponse.json({ error: 'Code and productId are required' }, { status: 400 });
        }

        const nozzle = await prisma.nozzle.create({
            data: {
                dispenserId,
                code,
                productId
            },
            include: {
                product: { select: { id: true, name: true, code: true } }
            }
        });

        return NextResponse.json({ nozzle }, { status: 201 });
    } catch (error) {
        console.error('Create nozzle error:', error);
        return NextResponse.json({ error: 'Failed to create nozzle' }, { status: 500 });
    }
}
