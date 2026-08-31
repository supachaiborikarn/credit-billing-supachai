import { NextRequest, NextResponse } from 'next/server';
import { requireGasProductsEnabled, requireGasStationAccess } from '@/lib/gas/api-guards';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    const { id } = await params;
    const auth = await requireGasStationAccess(id);
    if (auth.response) return auth.response;
    const productsDisabled = requireGasProductsEnabled(auth.station);
    if (productsDisabled) return productsDisabled;

    return NextResponse.json({
        error: 'endpoint รับสินค้าแบบเก่าถูกยกเลิกแล้ว',
        canonicalInventory: '/stations/station-5/inventory',
        inventoryApi: '/api/gas-station/5/products',
        action: 'receive',
    }, { status: 410 });
}
