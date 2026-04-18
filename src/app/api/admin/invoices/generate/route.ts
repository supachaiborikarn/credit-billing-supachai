import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { generateAllMonthlyInvoices } from '@/services/credit-service';

// POST - สร้าง Invoice ทั้งหมดสำหรับเดือนที่ระบุ
export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const { month, year } = body;

        if (!month || !year) {
            return NextResponse.json({ error: 'กรุณาระบุเดือนและปี' }, { status: 400 });
        }

        const result = await generateAllMonthlyInvoices(month, year);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Generate invoices error:', error);
        return NextResponse.json({ error: 'Failed to generate invoices' }, { status: 500 });
    }
}
