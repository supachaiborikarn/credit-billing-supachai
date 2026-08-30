import { retiredGasControlResponse } from '@/lib/gas/retired-admin-v1';

const replacements = {
    readPath: '/api/v2/gas/admin/gauge',
    editPath: '/admin/gas/data-entry',
};

export async function GET() { return retiredGasControlResponse(replacements); }
export async function POST() { return retiredGasControlResponse(replacements); }
