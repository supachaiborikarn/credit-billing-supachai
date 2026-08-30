import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { deleteNozzleAdmin, updateNozzleAdmin } from '@/services/dispenser-admin-service';

function resultStatus(code: string) {
    return code === 'NOT_FOUND' ? 404 : 400;
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string; nozzleId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { stationId, dispenserId, nozzleId } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }
        const input = body as Record<string, unknown>;
        const code = input.code === undefined ? undefined : typeof input.code === 'string' ? input.code.trim() : null;
        const productId = input.productId === undefined ? undefined : typeof input.productId === 'string' ? input.productId.trim() : null;
        const isActive = input.isActive === undefined ? undefined : typeof input.isActive === 'boolean' ? input.isActive : null;
        if (code === null || (typeof code === 'string' && (!code || code.length > 50)) || productId === null || productId === '' || isActive === null) {
            return NextResponse.json({ error: 'ข้อมูลหัวจ่ายไม่ถูกต้อง' }, { status: 400 });
        }
        if (code === undefined && productId === undefined && isActive === undefined) {
            return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' }, { status: 400 });
        }

        const result = await updateNozzleAdmin({ stationId, dispenserId, nozzleId, code, productId, isActive, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        return NextResponse.json({ nozzle: result.value });
    } catch (error) {
        console.error('Update nozzle error:', error);
        return NextResponse.json({ error: 'Failed to update nozzle' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ stationId: string; dispenserId: string; nozzleId: string }> }
) {
    try {
        void request;
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { stationId, dispenserId, nozzleId } = await params;

        const result = await deleteNozzleAdmin({ stationId, dispenserId, nozzleId, userId: auth.user.id });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: resultStatus(result.code) });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete nozzle error:', error);
        return NextResponse.json({ error: 'Failed to delete nozzle' }, { status: 500 });
    }
}
