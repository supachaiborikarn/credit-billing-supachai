import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';

const RETIRED_PAYLOAD = {
    error: 'Legacy GAS history API retired',
    retired: true,
    readPath: '/admin/gas/reports/daily',
    editPath: '/admin/gas/data-entry',
    operationsPath: '/admin/gas/operations',
};

async function retiredResponse() {
    const auth = await requireAdminApi();
    if (auth.response) return auth.response;
    return NextResponse.json(RETIRED_PAYLOAD, { status: 410 });
}

export async function GET() {
    return retiredResponse();
}

export async function POST() {
    return retiredResponse();
}

export async function DELETE() {
    return retiredResponse();
}
