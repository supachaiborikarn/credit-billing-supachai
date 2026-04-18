import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

// POST - Create nozzle for dispenser
export async function POST(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId } = await params;
        const body = await request.json();
        const { code, productId } = body;

        if (!code || !productId) {
            return NextResponse.json({ error: 'Code and productId are required' }, { status: 400 });
        }

        const dispenser = await prisma.dispenser.findFirst({
            where: { id: dispenserId, stationId, deletedAt: null },
            select: { id: true },
        });

        if (!dispenser) {
            return NextResponse.json({ error: 'Dispenser not found' }, { status: 404 });
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
