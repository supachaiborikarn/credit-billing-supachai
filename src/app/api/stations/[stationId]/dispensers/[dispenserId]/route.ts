import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireStationAccessApi } from '@/lib/api-auth';

// PUT - Update dispenser
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId } = await params;
        const body = await request.json();
        const { code, isActive } = body;

        const existing = await prisma.dispenser.findFirst({
            where: { id: dispenserId, stationId, deletedAt: null },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Dispenser not found' }, { status: 404 });
        }

        const dispenser = await prisma.dispenser.update({
            where: { id: dispenserId },
            data: {
                ...(code !== undefined && { code }),
                ...(isActive !== undefined && { isActive })
            },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        return NextResponse.json({ dispenser });
    } catch (error) {
        console.error('Update dispenser error:', error);
        return NextResponse.json({ error: 'Failed to update dispenser' }, { status: 500 });
    }
}

// DELETE - Soft delete dispenser
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId } = await params;

        const existing = await prisma.dispenser.findFirst({
            where: { id: dispenserId, stationId, deletedAt: null },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Dispenser not found' }, { status: 404 });
        }

        // Soft delete dispenser and its nozzles
        await prisma.$transaction([
            prisma.nozzle.updateMany({
                where: { dispenserId },
                data: { deletedAt: new Date() }
            }),
            prisma.dispenser.update({
                where: { id: dispenserId },
                data: { deletedAt: new Date() }
            })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete dispenser error:', error);
        return NextResponse.json({ error: 'Failed to delete dispenser' }, { status: 500 });
    }
}

// GET - Get single dispenser
export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const { stationId, dispenserId } = await params;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const dispenser = await prisma.dispenser.findUnique({
            where: { id: dispenserId },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    },
                    orderBy: { code: 'asc' }
                }
            }
        });

        if (!dispenser || dispenser.stationId !== stationId) {
            return NextResponse.json({ error: 'Dispenser not found' }, { status: 404 });
        }

        return NextResponse.json({ dispenser });
    } catch (error) {
        console.error('Get dispenser error:', error);
        return NextResponse.json({ error: 'Failed to fetch dispenser' }, { status: 500 });
    }
}
