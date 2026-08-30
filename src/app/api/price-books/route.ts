import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import {
    createLinePriceBook,
    normalizeConfiguredStationId,
    parsePriceBookDate,
    parsePriceBookLines,
    PRICE_BOOK_STATUSES,
} from '@/services/price-book-admin-service';

export async function GET(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { searchParams } = new URL(request.url);
        const rawStationId = searchParams.get('stationId');
        const rawStatus = searchParams.get('status');
        const stationId = rawStationId === null ? null : normalizeConfiguredStationId(rawStationId, false);
        if (rawStationId !== null && stationId === undefined) {
            return NextResponse.json({ error: 'สถานีไม่ถูกต้อง' }, { status: 400 });
        }
        if (rawStatus !== null && !PRICE_BOOK_STATUSES.includes(rawStatus as (typeof PRICE_BOOK_STATUSES)[number])) {
            return NextResponse.json({ error: 'สถานะ PriceBook ไม่ถูกต้อง' }, { status: 400 });
        }
        const priceBooks = await prisma.priceBook.findMany({
            where: {
                ...(rawStationId !== null && { stationId }),
                ...(rawStatus !== null && { status: rawStatus as (typeof PRICE_BOOK_STATUSES)[number] }),
            },
            include: {
                station: { select: { id: true, name: true } },
                lines: { include: { product: { select: { id: true, name: true, code: true } } } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { effectiveFrom: 'desc' },
        });
        return NextResponse.json({ priceBooks });
    } catch (error) {
        console.error('Get price books error:', error);
        return NextResponse.json({ error: 'Failed to fetch price books' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูล PriceBook ไม่ถูกต้อง' }, { status: 400 });
        }
        const input = body as Record<string, unknown>;
        const stationId = normalizeConfiguredStationId(input.stationId, true);
        if (input.stationId !== undefined && input.stationId !== null && input.stationId !== '' && stationId === undefined) {
            return NextResponse.json({ error: 'สร้าง PriceBook ได้เฉพาะ global หรือสถานีที่ยัง active' }, { status: 400 });
        }
        const effectiveFrom = parsePriceBookDate(input.effectiveFrom);
        if (!effectiveFrom) return NextResponse.json({ error: 'effectiveFrom ไม่ถูกต้อง' }, { status: 400 });
        const effectiveTo = input.effectiveTo === undefined || input.effectiveTo === null || input.effectiveTo === ''
            ? null
            : parsePriceBookDate(input.effectiveTo);
        if (effectiveTo === undefined) return NextResponse.json({ error: 'effectiveTo ไม่ถูกต้อง' }, { status: 400 });
        const lines = parsePriceBookLines(input.lines);
        if (!lines) return NextResponse.json({ error: 'lines ต้องมี 1-100 รายการ, product ไม่ซ้ำ และราคาต้องมากกว่า 0' }, { status: 400 });

        const result = await createLinePriceBook({
            stationId: stationId ?? null,
            effectiveFrom,
            effectiveTo,
            lines,
            userId: auth.user.id,
        });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ priceBook: result.value }, { status: 201 });
    } catch (error) {
        console.error('Create price book error:', error);
        return NextResponse.json({ error: 'Failed to create price book' }, { status: 500 });
    }
}
