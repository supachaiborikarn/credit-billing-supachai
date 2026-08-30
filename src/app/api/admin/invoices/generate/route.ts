import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { generateAllMonthlyInvoices } from '@/services/monthly-invoice-service';

export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null) as { month?: unknown; year?: unknown } | null;
        const month = Number(body?.month);
        const year = Number(body?.year);

        if (!Number.isInteger(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: 'เดือนต้องอยู่ระหว่าง 1-12' }, { status: 400 });
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return NextResponse.json({ error: 'ปีไม่ถูกต้อง' }, { status: 400 });
        }

        const result = await generateAllMonthlyInvoices(month, year, auth.user.id);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Generate invoices error:', error);
        return NextResponse.json({ error: 'Failed to generate invoices' }, { status: 500 });
    }
}
