import { retiredGasControlResponse } from '@/lib/gas/retired-admin-v1';

export async function POST() {
    return retiredGasControlResponse({
        dailyReportPath: '/api/v2/gas/admin/reports/daily',
        shiftReportPath: '/api/v2/gas/admin/reports/shift',
        meterReportPath: '/api/v2/gas/admin/reports/meters',
        executiveReportPath: '/api/v2/gas/admin/reports/executive',
    });
}
