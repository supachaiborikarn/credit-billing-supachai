import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    void await params;
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Legacy admin owner edit API retired',
        canonicalCustomers: '/customers',
        canonicalOwnerApi: '/api/owners/[id]',
        note: 'Use the ADMIN-only canonical owner master-data contract.',
    }, { status: 410 });
}
