import { NextResponse } from 'next/server';
import { checkLowStock } from '@/services/inventory-service';
import { requireAdminApi } from '@/lib/api-auth';

// GET - ดึงรายการสินค้าสต็อกต่ำ
export async function GET(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId') || undefined;

        const lowStockItems = await checkLowStock(stationId);

        return NextResponse.json({
            items: lowStockItems,
            count: lowStockItems.length,
            hasAlerts: lowStockItems.length > 0
        });
    } catch (error) {
        console.error('Low stock API error:', error);
        return NextResponse.json({ error: 'Failed to fetch low stock' }, { status: 500 });
    }
}
