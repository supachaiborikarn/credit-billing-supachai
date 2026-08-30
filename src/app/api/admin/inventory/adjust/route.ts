import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { adjustInventory } from '@/services/inventory-service';

// POST - ปรับสต็อกสินค้า
export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null) as { stationId?: unknown; productId?: unknown; quantityChange?: unknown; reason?: unknown } | null;
        const stationId = typeof body?.stationId === 'string' ? body.stationId.trim() : '';
        const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
        const quantityChange = Number(body?.quantityChange);
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

        if (!stationId || !productId) {
            return NextResponse.json({ error: 'กรุณาระบุ stationId และ productId' }, { status: 400 });
        }
        if (!Number.isInteger(quantityChange) || quantityChange === 0) {
            return NextResponse.json({ error: 'จำนวนปรับต้องเป็นจำนวนเต็มและไม่เท่ากับ 0' }, { status: 400 });
        }
        if (reason.length < 3 || reason.length > 200) {
            return NextResponse.json({ error: 'กรุณาระบุเหตุผล 3-200 ตัวอักษร' }, { status: 400 });
        }

        const result = await adjustInventory(stationId, productId, quantityChange, auth.user.id, reason);

        if (!result.success) {
            const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'CONFLICT' ? 409 : 400;
            return NextResponse.json({ error: result.error }, { status });
        }

        return NextResponse.json({
            success: true,
            inventoryId: result.inventoryId,
            previousQuantity: result.previousQuantity,
            newQuantity: result.newQuantity,
        });
    } catch (error) {
        console.error('Inventory adjust error:', error);
        return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
    }
}
