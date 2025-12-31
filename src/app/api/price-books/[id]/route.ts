import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get single price book
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const priceBook = await prisma.priceBook.findUnique({
            where: { id },
            include: {
                station: { select: { id: true, name: true } },
                lines: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                },
                createdBy: { select: { id: true, name: true } }
            }
        });

        if (!priceBook) {
            return NextResponse.json({ error: 'Price book not found' }, { status: 404 });
        }

        return NextResponse.json({ priceBook });
    } catch (error) {
        console.error('Get price book error:', error);
        return NextResponse.json({ error: 'Failed to fetch price book' }, { status: 500 });
    }
}

// PUT - Update price book
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { effectiveFrom, effectiveTo, status, lines } = body;

        // Update price book
        const priceBook = await prisma.priceBook.update({
            where: { id },
            data: {
                ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }),
                ...(effectiveTo !== undefined && { effectiveTo: effectiveTo ? new Date(effectiveTo) : null }),
                ...(status && { status })
            }
        });

        // Update lines if provided
        if (lines && lines.length > 0) {
            // Delete existing lines
            await prisma.priceBookLine.deleteMany({
                where: { priceBookId: id }
            });

            // Create new lines
            await prisma.priceBookLine.createMany({
                data: lines.map((line: { productId: string; pricePerUnit: number }) => ({
                    priceBookId: id,
                    productId: line.productId,
                    pricePerUnit: line.pricePerUnit
                }))
            });
        }

        // Fetch updated price book
        const updated = await prisma.priceBook.findUnique({
            where: { id },
            include: {
                lines: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        return NextResponse.json({ priceBook: updated });
    } catch (error) {
        console.error('Update price book error:', error);
        return NextResponse.json({ error: 'Failed to update price book' }, { status: 500 });
    }
}

// DELETE - Delete price book (only DRAFT)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if price book is DRAFT
        const priceBook = await prisma.priceBook.findUnique({
            where: { id },
            select: { status: true }
        });

        if (!priceBook) {
            return NextResponse.json({ error: 'Price book not found' }, { status: 404 });
        }

        if (priceBook.status !== 'DRAFT') {
            return NextResponse.json({ error: 'Only DRAFT price books can be deleted' }, { status: 400 });
        }

        // Delete lines first, then price book
        await prisma.$transaction([
            prisma.priceBookLine.deleteMany({ where: { priceBookId: id } }),
            prisma.priceBook.delete({ where: { id } })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete price book error:', error);
        return NextResponse.json({ error: 'Failed to delete price book' }, { status: 500 });
    }
}
