import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

export async function GET() {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Reconciliation list moved to GAS shift report',
        retired: true,
        reportPath: '/admin/gas/reports/shift?view=reconciliation',
        editApiPattern: '/api/v2/gas/admin/reconciliation/[shiftId]',
    }, { status: 410 });
}
