import { NextResponse } from 'next/server';
import { updateInventory } from '@/services/inventory-service';

// POST - ปรับสต็อกสินค้า
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { stationId, productId, quantityChange } = body;

        if (!stationId || !productId) {
            return NextResponse.json({ error: 'กรุณาระบุ stationId และ productId' }, { status: 400 });
        }

        if (quantityChange === undefined || quantityChange === 0) {
            return NextResponse.json({ error: 'กรุณาระบุจำนวนที่ต้องการปรับ' }, { status: 400 });
        }

        const result = await updateInventory(stationId, productId, quantityChange);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, newQuantity: result.newQuantity });
    } catch (error) {
        console.error('Inventory adjust error:', error);
        return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
    }
}
