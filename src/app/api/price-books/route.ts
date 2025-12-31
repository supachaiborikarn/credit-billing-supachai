import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all price books
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const status = searchParams.get('status');

        const priceBooks = await prisma.priceBook.findMany({
            where: {
                ...(stationId && { stationId }),
                ...(status && { status: status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' })
            },
            include: {
                station: { select: { id: true, name: true } },
                lines: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                },
                createdBy: { select: { id: true, name: true } }
            },
            orderBy: { effectiveFrom: 'desc' }
        });

        return NextResponse.json({ priceBooks });
    } catch (error) {
        console.error('Get price books error:', error);
        return NextResponse.json({ error: 'Failed to fetch price books' }, { status: 500 });
    }
}

// POST - Create new price book
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { stationId, effectiveFrom, effectiveTo, lines } = body;

        if (!effectiveFrom || !lines || lines.length === 0) {
            return NextResponse.json({ error: 'effectiveFrom and lines are required' }, { status: 400 });
        }

        const priceBook = await prisma.priceBook.create({
            data: {
                stationId: stationId || null,
                effectiveFrom: new Date(effectiveFrom),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
                status: 'DRAFT',
                lines: {
                    create: lines.map((line: { productId: string; pricePerUnit: number }) => ({
                        productId: line.productId,
                        pricePerUnit: line.pricePerUnit
                    }))
                }
            },
            include: {
                lines: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        return NextResponse.json({ priceBook }, { status: 201 });
    } catch (error) {
        console.error('Create price book error:', error);
        return NextResponse.json({ error: 'Failed to create price book' }, { status: 500 });
    }
}
