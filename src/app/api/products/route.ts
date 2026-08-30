import { NextResponse } from 'next/server';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

const LEGACY_PRODUCT_REPLACEMENTS = {
    canonicalInventory: '/stations/station-5/inventory',
    stationProductApi: '/api/gas-station/5/products',
} as const;

export async function GET() {
    const auth = await requireApiSession();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Legacy global Product API retired',
        retired: true,
        replacements: LEGACY_PRODUCT_REPLACEMENTS,
    }, { status: 410 });
}

export async function POST(request: Request) {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;
    void request;

    return NextResponse.json({
        error: 'Legacy global Product API retired',
        retired: true,
        replacements: LEGACY_PRODUCT_REPLACEMENTS,
    }, { status: 410 });
}
