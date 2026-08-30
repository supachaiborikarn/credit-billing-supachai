import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireStationAccessApi } from '@/lib/api-auth';
import { deleteDispenserAdmin, updateDispenserAdmin } from '@/services/dispenser-admin-service';

function resultStatus(code: string) {
    return code === 'NOT_FOUND' ? 404 : 400;
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId, dispenserId } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }
        const input = body as Record<string, unknown>;
        const code = input.code === undefined ? undefined : typeof input.code === 'string' ? input.code.trim() : null;
        const isActive = input.isActive === undefined ? undefined : typeof input.isActive === 'boolean' ? input.isActive : null;
        if (code === null || (typeof code === 'string' && (!code || code.length > 50)) || isActive === null) {
            return NextResponse.json({ error: 'ข้อมูลตู้จ่ายไม่ถูกต้อง' }, { status: 400 });
        }
        if (code === undefined && isActive === undefined) {
            return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
        }

        const result = await updateDispenserAdmin({ stationId, dispenserId, code, isActive, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        return NextResponse.json({ dispenser: result.value });
    } catch (error) {
        console.error('Update dispenser error:', error);
        return NextResponse.json({ error: 'Failed to update dispenser' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        void request;
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { stationId, dispenserId } = await params;

        const result = await deleteDispenserAdmin({ stationId, dispenserId, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete dispenser error:', error);
        return NextResponse.json({ error: 'Failed to delete dispenser' }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string }> }
) {
    try {
        void request;
        const { stationId, dispenserId } = await params;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const dispenser = await prisma.dispenser.findFirst({
            where: { id: dispenserId, stationId, deletedAt: null },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: { product: { select: { id: true, name: true, code: true } } },
                    orderBy: { code: 'asc' },
                },
            },
        });

        if (!dispenser) return NextResponse.json({ error: 'Dispenser not found' }, { status: 404 });
        return NextResponse.json({ dispenser });
    } catch (error) {
        console.error('Get dispenser error:', error);
        return NextResponse.json({ error: 'Failed to fetch dispenser' }, { status: 500 });
    }
}
