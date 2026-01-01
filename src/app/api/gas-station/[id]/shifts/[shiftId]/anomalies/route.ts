import { NextRequest, NextResponse } from 'next/server';
import { checkShiftAnomalies } from '@/services/anomaly-detection';

// GET - ตรวจสอบ anomaly ของกะ
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { shiftId } = await params;

        const result = await checkShiftAnomalies(shiftId);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Anomaly check error:', error);
        return NextResponse.json({ error: 'Failed to check anomalies' }, { status: 500 });
    }
}
