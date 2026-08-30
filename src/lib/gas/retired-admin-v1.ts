import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

export async function retiredGasControlResponse(replacements: Record<string, string>) {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;
    return NextResponse.json({
        error: 'Legacy Gas Control v1 API retired',
        retired: true,
        ...replacements,
    }, { status: 410 });
}
