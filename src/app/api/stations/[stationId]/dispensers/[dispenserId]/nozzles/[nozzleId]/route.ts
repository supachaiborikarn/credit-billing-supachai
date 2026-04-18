import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

// PUT - Update nozzle
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string; nozzleId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId, nozzleId } = await params;
        const body = await request.json();
        const { code, productId, isActive } = body;

        const existing = await prisma.nozzle.findFirst({
            where: {
                id: nozzleId,
                dispenserId,
                deletedAt: null,
                dispenser: { stationId },
            },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Nozzle not found' }, { status: 404 });
        }

        const nozzle = await prisma.nozzle.update({
            where: { id: nozzleId },
            data: {
                ...(code !== undefined && { code }),
                ...(productId !== undefined && { productId }),
                ...(isActive !== undefined && { isActive })
            },
            include: {
                product: { select: { id: true, name: true, code: true } }
            }
        });

        return NextResponse.json({ nozzle });
    } catch (error) {
        console.error('Update nozzle error:', error);
        return NextResponse.json({ error: 'Failed to update nozzle' }, { status: 500 });
    }
}

// DELETE - Soft delete nozzle
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string; nozzleId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId, nozzleId } = await params;

        const existing = await prisma.nozzle.findFirst({
            where: {
                id: nozzleId,
                dispenserId,
                deletedAt: null,
                dispenser: { stationId },
            },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Nozzle not found' }, { status: 404 });
        }

        await prisma.nozzle.update({
            where: { id: nozzleId },
            data: { deletedAt: new Date() }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete nozzle error:', error);
        return NextResponse.json({ error: 'Failed to delete nozzle' }, { status: 500 });
    }
}
