import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

export async function GET(request: Request) {
    void request;
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Legacy admin owner list retired',
        canonicalCustomers: '/customers',
        canonicalCustomersApi: '/api/customers',
        canonicalBilling: '/billing',
        note: 'Owner.currentCredit is legacy-only and is not an AR source of truth.',
    }, { status: 410 });
}
