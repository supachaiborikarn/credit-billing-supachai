import { NextResponse } from 'next/server';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

const LEGACY_PAYMENT_REPLACEMENTS = {
    billingWorkspace: '/billing',
    invoicePaymentApi: '/api/invoices/[invoiceId]/payments',
} as const;

export async function POST(request: Request) {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;
    void request;

    return NextResponse.json({
        error: 'Legacy payment API retired',
        retired: true,
        replacements: LEGACY_PAYMENT_REPLACEMENTS,
    }, { status: 410 });
}

export async function GET(request: Request) {
    const auth = await requireApiSession();
    if (auth.response) return auth.response;
    void request;

    return NextResponse.json({
        error: 'Legacy payment API retired',
        retired: true,
        replacements: LEGACY_PAYMENT_REPLACEMENTS,
    }, { status: 410 });
}
