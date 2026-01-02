import { NextResponse } from 'next/server';
import { getPendingAnomalies } from '@/services/anomaly-detection';

// GET - ดึงรายการ anomaly ที่ยังไม่ได้ตรวจสอบ
export async function GET() {
    try {
        const anomalies = await getPendingAnomalies();

        return NextResponse.json({ anomalies });
    } catch (error) {
        console.error('Anomalies API error:', error);
        return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
    }
}
