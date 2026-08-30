import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';
import {
    deleteLinePriceBook,
    isPriceBookStatus,
    parsePriceBookDate,
    parsePriceBookLines,
    updateLinePriceBook,
} from '@/services/price-book-admin-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { id } = await params;
        const priceBook = await prisma.priceBook.findUnique({
            where: { id },
            include: {
                station: { select: { id: true, name: true } },
                lines: { include: { product: { select: { id: true, name: true, code: true } } } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!priceBook) return NextResponse.json({ error: 'Price book not found' }, { status: 404 });
        return NextResponse.json({ priceBook });
    } catch (error) {
        console.error('Get price book error:', error);
        return NextResponse.json({ error: 'Failed to fetch price book' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { id } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูล PriceBook ไม่ถูกต้อง' }, { status: 400 });
        }
        const input = body as Record<string, unknown>;
        if (Object.keys(input).length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
        let effectiveFrom: Date | undefined;
        if (input.effectiveFrom !== undefined) {
            effectiveFrom = parsePriceBookDate(input.effectiveFrom);
            if (!effectiveFrom) return NextResponse.json({ error: 'effectiveFrom ไม่ถูกต้อง' }, { status: 400 });
        }
        let effectiveTo: Date | null | undefined;
        if (input.effectiveTo !== undefined) {
            if (input.effectiveTo === null || input.effectiveTo === '') effectiveTo = null;
            else {
                effectiveTo = parsePriceBookDate(input.effectiveTo);
                if (!effectiveTo) return NextResponse.json({ error: 'effectiveTo ไม่ถูกต้อง' }, { status: 400 });
            }
        }
        if (input.status !== undefined && !isPriceBookStatus(input.status)) {
            return NextResponse.json({ error: 'status ไม่ถูกต้อง' }, { status: 400 });
        }
        let lines;
        if (input.lines !== undefined) {
            lines = parsePriceBookLines(input.lines);
            if (!lines) return NextResponse.json({ error: 'lines ต้องมี 1-100 รายการ, product ไม่ซ้ำ และราคาต้องมากกว่า 0' }, { status: 400 });
        }
        const result = await updateLinePriceBook({
            id,
            effectiveFrom,
            effectiveTo,
            status: isPriceBookStatus(input.status) ? input.status : undefined,
            lines,
            userId: auth.user.id,
        });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ priceBook: result.value });
    } catch (error) {
        console.error('Update price book error:', error);
        return NextResponse.json({ error: 'Failed to update price book' }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { id } = await params;
        const result = await deleteLinePriceBook({ id, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json(result.value);
    } catch (error) {
        console.error('Delete price book error:', error);
        return NextResponse.json({ error: 'Failed to delete price book' }, { status: 500 });
    }
}
