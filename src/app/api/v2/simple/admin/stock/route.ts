import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

export async function GET() {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;

    return NextResponse.json({
        error: 'Simple stock mock retired',
        retired: true,
        overviewPath: '/admin/simple',
        reason: 'No production tank inventory source exists for retired SIMPLE stations',
    }, { status: 410 });
}
