import { retiredGasControlResponse } from '@/lib/gas/retired-admin-v1';

export async function GET() {
    return retiredGasControlResponse({
        dashboardPath: '/api/v2/gas/admin/dashboard',
        operationsPath: '/api/v2/gas/admin/operations',
        dataEntryPath: '/admin/gas/data-entry',
    });
}
