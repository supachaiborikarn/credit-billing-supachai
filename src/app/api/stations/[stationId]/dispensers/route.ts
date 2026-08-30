import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireStationAccessApi } from '@/lib/api-auth';
import { createDispenserAdmin, type DispenserNozzleInput } from '@/services/dispenser-admin-service';

function resultStatus(code: string) {
    return code === 'NOT_FOUND' ? 404 : 400;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        void request;
        const { stationId } = await params;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const dispensers = await prisma.dispenser.findMany({
            where: { stationId, deletedAt: null },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: { product: { select: { id: true, name: true, code: true } } },
                    orderBy: { code: 'asc' },
                },
            },
            orderBy: { code: 'asc' },
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
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { stationId } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }

        const input = body as Record<string, unknown>;
        const code = typeof input.code === 'string' ? input.code.trim() : '';
        if (!code || code.length > 50) {
            return NextResponse.json({ error: 'Dispenser code is required (max 50 chars)' }, { status: 400 });
        }

        let nozzles: DispenserNozzleInput[] = [];
        if (input.nozzles !== undefined) {
            if (!Array.isArray(input.nozzles) || input.nozzles.length > 20) {
                return NextResponse.json({ error: 'Nozzles must be an array with at most 20 items' }, { status: 400 });
            }
            nozzles = input.nozzles.map((value) => {
                const row = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
                return {
                    code: typeof row.code === 'string' ? row.code.trim() : '',
                    productId: typeof row.productId === 'string' ? row.productId.trim() : '',
                };
            });
            if (nozzles.some((nozzle) => !nozzle.code || nozzle.code.length > 50 || !nozzle.productId)) {
                return NextResponse.json({ error: 'Nozzle code and productId are required' }, { status: 400 });
            }
        }

        const result = await createDispenserAdmin({ stationId, code, nozzles, userId: auth.user.id });
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        }

        return NextResponse.json({ dispenser: result.value }, { status: 201 });
    } catch (error) {
        console.error('Create dispenser error:', error);
        return NextResponse.json({ error: 'Failed to create dispenser' }, { status: 500 });
    }
}
