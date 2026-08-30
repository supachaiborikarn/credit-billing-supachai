import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

const FIX_SHIFT_REPLACEMENTS = {
    gasStaleShiftCleanup: '/admin/gas/operations',
    antiFraudReview: '/admin/alerts',
    canonicalOperations: '/stations/[stationId]/operations',
} as const;

export async function POST(request: Request) {
    void request;
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Temporary fix-shift API retired',
        retired: true,
        replacements: FIX_SHIFT_REPLACEMENTS,
    }, { status: 410 });
}
