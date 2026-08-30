import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { createNozzleAdmin } from '@/services/dispenser-admin-service';

function resultStatus(code: string) {
    return code === 'NOT_FOUND' ? 404 : 400;
}

export async function POST(
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
        const code = typeof input.code === 'string' ? input.code.trim() : '';
        const productId = typeof input.productId === 'string' ? input.productId.trim() : '';
        if (!code || code.length > 50 || !productId) {
            return NextResponse.json({ error: 'Code and productId are required' }, { status: 400 });
        }

        const result = await createNozzleAdmin({ stationId, dispenserId, code, productId, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        return NextResponse.json({ nozzle: result.value }, { status: 201 });
    } catch (error) {
        console.error('Create nozzle error:', error);
        return NextResponse.json({ error: 'Failed to create nozzle' }, { status: 500 });
    }
}
