import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { getPendingAnomalies } from '@/services/anomaly-detection';

export async function GET() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const anomalies = await getPendingAnomalies();
        return NextResponse.json({ anomalies });
    } catch (error) {
        console.error('Anomalies API error:', error);
        return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
    }
}
