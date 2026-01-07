import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok, formatDateBangkok } from '@/lib/date-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'daily';
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Set date range using Bangkok timezone
        const endStr = endDateParam || getTodayBangkok();
        const end = getEndOfDayBangkok(endStr);

        let startStr = getTodayBangkok();
        if (startDateParam) {
            startStr = startDateParam;
        } else {
            const today = new Date();
            today.setDate(today.getDate() - 30);
            startStr = today.toISOString().split('T')[0];
        }
        const start = getStartOfDayBangkok(startStr);

        // Handle shift_meters type separately
        if (type === 'shift_meters') {
            const shifts = await prisma.shift.findMany({
                where: {
                    dailyRecord: {
                        date: { gte: start, lte: end }
                    }
                },
                include: {
                    dailyRecord: {
                        select: {
                            date: true,
                            station: { select: { name: true } }
                        }
                    },
                    staff: { select: { name: true } },
                    meters: {
                        select: {
                            nozzleNumber: true,
                            startReading: true,
                            endReading: true,
                            soldQty: true
                        },
                        orderBy: { nozzleNumber: 'asc' }
                    }
                },
                orderBy: [
                    { dailyRecord: { date: 'desc' } },
                    { shiftNumber: 'desc' }
                ]
            });

            const shiftHeaders = [
                'วันที่',
                'สถานี',
                'กะ',
                'พนักงาน',
                'สถานะ',
                'หัวจ่าย1-เริ่ม',
                'หัวจ่าย1-สิ้นสุด',
                'หัวจ่าย1-ขาย',
                'หัวจ่าย2-เริ่ม',
                'หัวจ่าย2-สิ้นสุด',
                'หัวจ่าย2-ขาย',
                'หัวจ่าย3-เริ่ม',
                'หัวจ่าย3-สิ้นสุด',
                'หัวจ่าย3-ขาย',
                'หัวจ่าย4-เริ่ม',
                'หัวจ่าย4-สิ้นสุด',
                'หัวจ่าย4-ขาย',
                'รวมขาย'
            ];

            const shiftRows = shifts.map(s => {
                const getMeter = (nozzle: number) => s.meters.find(m => m.nozzleNumber === nozzle);
                const totalSold = s.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0);
                return [
                    formatDateBangkok(s.dailyRecord.date),
                    s.dailyRecord.station.name,
                    `กะ ${s.shiftNumber}`,
                    s.staff?.name || '-',
                    s.status === 'CLOSED' ? 'ปิดแล้ว' : 'เปิดอยู่',
                    ...([1, 2, 3, 4].flatMap(n => {
                        const m = getMeter(n);
                        return [
                            m ? Number(m.startReading).toFixed(2) : '-',
                            m?.endReading ? Number(m.endReading).toFixed(2) : '-',
                            m?.soldQty ? Number(m.soldQty).toFixed(2) : '-'
                        ];
                    })),
                    totalSold.toFixed(2)
                ];
            });

            const BOM = '\uFEFF';
            const csvContent = BOM + [
                shiftHeaders.join(','),
                ...shiftRows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const filename = `shift_meters_${startStr}_to_${endStr}.csv`;

            return new NextResponse(csvContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }

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
