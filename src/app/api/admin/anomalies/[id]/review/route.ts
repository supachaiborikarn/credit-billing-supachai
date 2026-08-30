import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { reviewMeterAnomaly } from '@/services/anomaly-detection';

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;
        const { id: anomalyId } = await params;
        if (!anomalyId) return NextResponse.json({ error: 'Anomaly ID required' }, { status: 400 });

        const result = await reviewMeterAnomaly(anomalyId, auth.user.id);
        if (result === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบรายการ anomaly' }, { status: 404 });
        if (result === 'ALREADY_REVIEWED') return NextResponse.json({ error: 'รายการนี้ตรวจสอบแล้ว' }, { status: 409 });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mark reviewed error:', error);
        return NextResponse.json({ error: 'Failed to mark as reviewed' }, { status: 500 });
    }
}
