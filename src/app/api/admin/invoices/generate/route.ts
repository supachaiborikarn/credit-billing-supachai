import { NextResponse } from 'next/server';
import { generateAllMonthlyInvoices } from '@/services/credit-service';

// POST - สร้าง Invoice ทั้งหมดสำหรับเดือนที่ระบุ
export async function POST(request: Request) {
    try {
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
