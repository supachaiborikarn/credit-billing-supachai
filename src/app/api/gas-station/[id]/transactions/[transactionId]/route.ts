import { NextRequest, NextResponse } from 'next/server';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    void request;
    const { id, transactionId } = await params;
    const auth = await requireGasStationAccess(id);
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Legacy GAS transaction delete API retired',
        retired: true,
        canonicalHistory: `/stations/${auth.station.dbId}/history`,
        managementWorkspace: '/admin/transactions',
        replacementApi: `/api/station/${auth.station.dbId}/transactions/${transactionId}`,
        requiresReason: true,
    }, { status: 410 });
}
