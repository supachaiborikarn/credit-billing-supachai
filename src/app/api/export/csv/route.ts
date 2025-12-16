import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'daily';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Set date range
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let start = new Date();
        if (startDate) {
            start = new Date(startDate);
        } else {
            start.setDate(start.getDate() - 30);
        }
        start.setHours(0, 0, 0, 0);

        // Fetch transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                date: { gte: start, lte: end }
            },
            select: {
                date: true,
                licensePlate: true,
                ownerName: true,
                paymentType: true,
                liters: true,
                pricePerLiter: true,
                amount: true,
                productType: true,
                billNo: true,
                billBookNo: true,
                owner: { select: { name: true, code: true } },
                station: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        // Generate CSV content
        const headers = [
            'วันที่',
            'สถานี',
            'ทะเบียน',
            'ลูกค้า',
            'รหัสลูกค้า',
            'ประเภทชำระ',
            'ประเภทน้ำมัน',
            'ลิตร',
            'ราคา/ลิตร',
            'รวมเงิน',
            'เล่ม/เลขบิล'
        ];

        const paymentTypeLabels: Record<string, string> = {
            'CASH': 'เงินสด',
            'CREDIT': 'เงินเชื่อ',
            'TRANSFER': 'โอนเงิน',
            'BOX_TRUCK': 'รถตู้ทึบ',
            'OIL_TRUCK_SUPACHAI': 'รถน้ำมันศุภชัย'
        };

        const rows = transactions.map(t => [
            new Date(t.date).toLocaleDateString('th-TH'),
            t.station.name,
            t.licensePlate || '-',
            t.owner?.name || t.ownerName || '-',
            t.owner?.code || '-',
            paymentTypeLabels[t.paymentType] || t.paymentType,
            t.productType || '-',
            Number(t.liters).toFixed(2),
            Number(t.pricePerLiter).toFixed(2),
            Number(t.amount).toFixed(2),
            `${t.billBookNo || '-'}/${t.billNo || '-'}`
        ]);

        // Add BOM for Thai character support in Excel
        const BOM = '\uFEFF';
        const csvContent = BOM + [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Return as downloadable file
        const filename = `report_${type}_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
    }
}
