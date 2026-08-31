import { NextResponse } from 'next/server';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    const { id } = await params;
    const auth = await requireGasStationAccess(id);
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Legacy GAS transaction write API retired',
        retired: true,
        canonicalSales: `/stations/${auth.station.dbId}/sales`,
        replacements: {
            saleApi: '/api/v2/gas/[stationId]/sell',
            shiftOperations: `/stations/${auth.station.dbId}/operations`,
            historicalAdminEntry: '/admin/gas/data-entry',
        },
    }, { status: 410 });
}
