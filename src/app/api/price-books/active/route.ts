import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/api-auth';
import { normalizeConfiguredStationId } from '@/services/price-book-admin-service';

export async function GET(request: Request) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;
        const { searchParams } = new URL(request.url);
        const rawStationId = searchParams.get('stationId');

        let stationId: string | null = null;
        if (rawStationId !== null) {
            const normalized = normalizeConfiguredStationId(rawStationId, false);
            if (normalized === undefined) return NextResponse.json({ error: 'สถานีไม่ถูกต้อง' }, { status: 400 });
            stationId = normalized;
        } else if (auth.user.role === 'STAFF' && auth.user.stationId) {
            const normalized = normalizeConfiguredStationId(auth.user.stationId, false);
            if (normalized === undefined) return NextResponse.json({ error: 'สถานีผู้ใช้ไม่ถูกต้อง' }, { status: 403 });
            stationId = normalized;
        }

        if (auth.user.role !== 'ADMIN' && stationId && normalizeConfiguredStationId(auth.user.stationId, false) !== stationId) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูราคาของสถานีนี้' }, { status: 403 });
        }

        const now = new Date();
        const priceBook = await prisma.priceBook.findFirst({
            where: {
                status: 'ACTIVE',
                effectiveFrom: { lte: now },
                lines: { some: {} },
                AND: [
                    { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
                    stationId
                        ? { OR: [{ stationId }, { stationId: null }] }
                        : { stationId: null },
                ],
            },
            include: {
                lines: { include: { product: { select: { id: true, name: true, code: true } } } },
            },
            orderBy: [
                { stationId: 'desc' },
                { effectiveFrom: 'desc' },
            ],
        });
        if (!priceBook) return NextResponse.json({ error: 'No active price book found' }, { status: 404 });
        const prices = Object.fromEntries(priceBook.lines.map((line) => [
            line.product.code,
            {
                productId: line.productId,
                productName: line.product.name,
                pricePerUnit: Number(line.pricePerUnit),
            },
        ]));
        return NextResponse.json({ priceBook, prices });
    } catch (error) {
        console.error('Get active price book error:', error);
        return NextResponse.json({ error: 'Failed to fetch active price book' }, { status: 500 });
    }
}
