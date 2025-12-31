import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get currently active price book
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');

        const now = new Date();

        // Find active price book for this station or global
        const priceBook = await prisma.priceBook.findFirst({
            where: {
                status: 'ACTIVE',
                effectiveFrom: { lte: now },
                AND: [
                    {
                        OR: [
                            { effectiveTo: null },
                            { effectiveTo: { gte: now } }
                        ]
                    },
                    stationId ? {
                        OR: [
                            { stationId },
                            { stationId: null }
                        ]
                    } : { stationId: null }
                ]
            },
            include: {
                lines: {
                    include: {
                        product: { select: { id: true, name: true, code: true } }
                    }
                }
            },
            orderBy: [
                { stationId: 'desc' }, // Station-specific first
                { effectiveFrom: 'desc' }
            ]
        });

        if (!priceBook) {
            return NextResponse.json({ error: 'No active price book found' }, { status: 404 });
        }

        // Transform to price lookup map
        const prices = Object.fromEntries(
            priceBook.lines.map(line => [
                line.product.code,
                {
                    productId: line.productId,
                    productName: line.product.name,
                    pricePerUnit: Number(line.pricePerUnit)
                }
            ])
        );

        return NextResponse.json({ priceBook, prices });
    } catch (error) {
        console.error('Get active price book error:', error);
        return NextResponse.json({ error: 'Failed to fetch active price book' }, { status: 500 });
    }
}
