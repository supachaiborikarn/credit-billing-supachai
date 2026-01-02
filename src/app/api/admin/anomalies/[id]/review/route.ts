import { NextRequest, NextResponse } from 'next/server';
import { markAnomalyReviewed } from '@/services/anomaly-detection';
import { getSessionUser } from '@/lib/auth-utils';

// POST - ทำเครื่องหมาย anomaly ว่าตรวจสอบแล้ว
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: anomalyId } = await params;

        // Get current user
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }

        await markAnomalyReviewed(anomalyId, user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mark reviewed error:', error);
        return NextResponse.json({ error: 'Failed to mark as reviewed' }, { status: 500 });
    }
}
