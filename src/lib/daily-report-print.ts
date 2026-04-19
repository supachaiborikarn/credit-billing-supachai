import { FUEL_TYPES } from '@/constants';

export interface PrintableDailyTransaction {
    id: string;
    date: string;
    licensePlate?: string | null;
    ownerName?: string | null;
    paymentType: string;
    fuelType?: string | null;
    liters: number;
    amount: number;
    billBookNo?: string | null;
    billNo?: string | null;
    recordedByName?: string | null;
}

interface PrintDailyWorkReportInput {
    stationName: string;
    reportDate: string;
    transactions: PrintableDailyTransaction[];
}

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    CREDIT_CARD: 'บัตรเครดิต',
    TRANSFER: 'โอนเงิน',
    BOX_TRUCK: 'รถตู้ทึบ',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
};

const fuelLabelMap = Object.fromEntries(FUEL_TYPES.map((fuel) => [fuel.value, fuel.label]));

function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatReportDate(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPaymentLabel(paymentType: string): string {
    return PAYMENT_LABELS[paymentType] || paymentType;
}

function getFuelLabel(fuelType?: string | null): string {
    if (!fuelType) {
        return '-';
    }

    return fuelLabelMap[fuelType] || fuelType;
}

export function printDailyWorkReport({
    stationName,
    reportDate,
    transactions,
}: PrintDailyWorkReportInput): boolean {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return false;
    }

    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const totalLiters = sortedTransactions.reduce((sum, transaction) => sum + Number(transaction.liters || 0), 0);
    const totalAmount = sortedTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const paymentTotals = sortedTransactions.reduce<Record<string, number>>((totals, transaction) => {
        totals[transaction.paymentType] = (totals[transaction.paymentType] || 0) + Number(transaction.amount || 0);
        return totals;
    }, {});

    const paymentSummaryRows = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'))
        .map(([paymentType, amount]) => `
            <tr>
                <td>${escapeHtml(getPaymentLabel(paymentType))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(amount))}</td>
            </tr>
        `)
        .join('');

    const transactionRows = sortedTransactions.length > 0
        ? sortedTransactions.map((transaction, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-center">${escapeHtml(formatTime(transaction.date))}</td>
                <td class="text-center">${escapeHtml(transaction.billBookNo || '-')} / ${escapeHtml(transaction.billNo || '-')}</td>
                <td>${escapeHtml(transaction.licensePlate || '-')}</td>
                <td>${escapeHtml(transaction.ownerName || '-')}</td>
                <td>${escapeHtml(getFuelLabel(transaction.fuelType))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(Number(transaction.liters || 0)))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(Number(transaction.amount || 0)))}</td>
                <td>${escapeHtml(getPaymentLabel(transaction.paymentType))}</td>
                <td>${escapeHtml(transaction.recordedByName || '-')}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="10" class="empty-state">ไม่พบรายการขายในวันดังกล่าว</td>
            </tr>
        `;

    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8" />
    <title>สรุปการทำงานทั้งวัน - ${escapeHtml(stationName)}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
            color: #111827;
            background: #ffffff;
            padding: 18px;
        }
        .header {
            text-align: center;
            margin-bottom: 18px;
            padding-bottom: 12px;
            border-bottom: 2px solid #111827;
        }
        .header h1 {
            margin: 0 0 6px;
            font-size: 22px;
        }
        .header p {
            margin: 0;
            color: #4b5563;
            font-size: 13px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 18px;
        }
        .summary-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 12px 14px;
            background: #f9fafb;
        }
        .summary-card .label {
            color: #6b7280;
            font-size: 12px;
            margin-bottom: 6px;
        }
        .summary-card .value {
            font-size: 20px;
            font-weight: 700;
        }
        .section-title {
            margin: 18px 0 8px;
            font-size: 15px;
            font-weight: 700;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th, td {
            border: 1px solid #d1d5db;
            padding: 7px 8px;
            vertical-align: top;
        }
        th {
            background: #f3f4f6;
            text-align: left;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .total-row {
            background: #ecfdf5;
            font-weight: 700;
        }
        .empty-state {
            text-align: center;
            color: #6b7280;
            padding: 20px 12px;
        }
        .footer {
            margin-top: 16px;
            color: #6b7280;
            font-size: 11px;
            text-align: right;
        }
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(stationName)}</h1>
        <p>รายงานสรุปการทำงานทั้งวัน วันที่ ${escapeHtml(formatReportDate(reportDate))}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">จำนวนรายการ</div>
            <div class="value">${escapeHtml(sortedTransactions.length)}</div>
        </div>
        <div class="summary-card">
            <div class="label">ปริมาณรวม</div>
            <div class="value">${escapeHtml(formatCurrency(totalLiters))} ลิตร</div>
        </div>
        <div class="summary-card">
            <div class="label">ยอดขายรวม</div>
            <div class="value">${escapeHtml(formatCurrency(totalAmount))} บาท</div>
        </div>
    </div>

    <div class="section-title">สรุปตามประเภทการชำระ</div>
    <table>
        <thead>
            <tr>
                <th>ประเภทชำระ</th>
                <th class="text-right">ยอดเงิน</th>
            </tr>
        </thead>
        <tbody>
            ${paymentSummaryRows || `
                <tr>
                    <td colspan="2" class="empty-state">ไม่พบยอดชำระ</td>
                </tr>
            `}
        </tbody>
    </table>

    <div class="section-title">รายละเอียดรายการขายทั้งวัน</div>
    <table>
        <thead>
            <tr>
                <th class="text-center">ลำดับ</th>
                <th class="text-center">เวลา</th>
                <th class="text-center">เล่ม / เลขที่</th>
                <th>ทะเบียน</th>
                <th>ชื่อ</th>
                <th>สินค้า</th>
                <th class="text-right">ลิตร</th>
                <th class="text-right">ยอดเงิน</th>
                <th>ชำระ</th>
                <th>ผู้บันทึก</th>
            </tr>
        </thead>
        <tbody>
            ${transactionRows}
            <tr class="total-row">
                <td colspan="6">รวมทั้งสิ้น</td>
                <td class="text-right">${escapeHtml(formatCurrency(totalLiters))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(totalAmount))}</td>
                <td colspan="2"></td>
            </tr>
        </tbody>
    </table>

    <div class="footer">พิมพ์เมื่อ ${escapeHtml(new Date().toLocaleString('th-TH'))}</div>

    <script>
        window.onload = function () {
            window.print();
        };
    </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    return true;
}
