import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Update nozzle
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string; nozzleId: string }> }
) {
    try {
        const { nozzleId } = await params;
        const body = await request.json();
        const { code, productId, isActive } = body;

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
        const { nozzleId } = await params;

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
