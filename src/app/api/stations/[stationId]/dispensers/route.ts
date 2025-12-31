import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        // Get all dispensers with their nozzles and products
        const dispensers = await prisma.dispenser.findMany({
            where: {
                stationId,
                deletedAt: null
            },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: {
                        product: {
                            select: { id: true, name: true, code: true }
                        }
                    },
                    orderBy: { code: 'asc' }
                }
            },
            orderBy: { code: 'asc' }
        });

        return NextResponse.json({ dispensers });
    } catch (error) {
        console.error('Get dispensers error:', error);
        return NextResponse.json({ error: 'Failed to fetch dispensers' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const body = await request.json();
        const { code, nozzles } = body;

        if (!code) {
            return NextResponse.json({ error: 'Dispenser code is required' }, { status: 400 });
        }

        // Create dispenser with nozzles
        const dispenser = await prisma.dispenser.create({
            data: {
                stationId,
                code,
                nozzles: nozzles?.length ? {
                    create: nozzles.map((n: { code: string; productId: string }) => ({
                        code: n.code,
                        productId: n.productId
                    }))
                } : undefined
            },
            include: {
                nozzles: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            }
        });

        return NextResponse.json({ dispenser }, { status: 201 });
    } catch (error) {
        console.error('Create dispenser error:', error);
        return NextResponse.json({ error: 'Failed to create dispenser' }, { status: 500 });
    }
}
