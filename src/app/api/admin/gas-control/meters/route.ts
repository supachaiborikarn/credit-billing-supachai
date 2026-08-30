import { retiredGasControlResponse } from '@/lib/gas/retired-admin-v1';

const replacements = {
    readPath: '/api/v2/gas/admin/reports/meters',
    editPath: '/admin/gas/data-entry',
    openingEditPath: '/admin/gas/reports/meters',
};

export async function GET() { return retiredGasControlResponse(replacements); }
export async function PUT() { return retiredGasControlResponse(replacements); }
