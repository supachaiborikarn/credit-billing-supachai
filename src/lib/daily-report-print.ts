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

export interface PrintableDailyMeter {
    nozzleNumber: number;
    fuelType?: string | null;
    price?: number | null;
    startReading: number;
    endReading?: number | null;
    liters?: number | null;
    amount?: number | null;
}

interface PrintDailyWorkReportInput {
    stationName: string;
    reportDate: string;
    transactions: PrintableDailyTransaction[];
    meters?: PrintableDailyMeter[];
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
    meters = [],
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
    const normalizedMeters = [...meters]
        .sort((a, b) => a.nozzleNumber - b.nozzleNumber)
        .map((meter) => {
            const startReading = Number(meter.startReading || 0);
            const endReading = Number(meter.endReading || 0);
            const liters = Number(meter.liters ?? Math.max(endReading - startReading, 0));
            const price = Number(meter.price || 0);
            const amount = Number(meter.amount ?? liters * price);

            return {
                ...meter,
                startReading,
                endReading,
                liters,
                price,
                amount,
            };
        });
    const totalMeterLiters = normalizedMeters.reduce((sum, meter) => sum + meter.liters, 0);
    const totalMeterAmount = normalizedMeters.reduce((sum, meter) => sum + meter.amount, 0);
    const paymentTotals = sortedTransactions.reduce<Record<string, number>>((totals, transaction) => {
        totals[transaction.paymentType] = (totals[transaction.paymentType] || 0) + Number(transaction.amount || 0);
        return totals;
    }, {});

    const paymentSummaryText = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'))
        .map(([paymentType, amount]) => `${getPaymentLabel(paymentType)} ${formatCurrency(amount)}`)
        .join(' | ');

    const meterRows = normalizedMeters.length > 0
        ? normalizedMeters.map((meter) => `
            <tr>
                <td class="text-center">${escapeHtml(meter.nozzleNumber)}</td>
                <td>${escapeHtml(meter.fuelType || 'ดีเซล B7')}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.startReading))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.endReading))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.liters))}</td>
                <td class="text-right">${escapeHtml(meter.price > 0 ? formatCurrency(meter.price) : '-')}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.amount))}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="7" class="empty-state">ไม่พบเลขมิเตอร์ในรายงานนี้</td>
            </tr>
        `;

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
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="9" class="empty-state">ไม่พบรายการขายในวันดังกล่าว</td>
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
            padding: 0;
            font-size: 10px;
        }
        .sheet {
            padding: 8mm;
        }
        .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 2px solid #111827;
        }
        .header h1 {
            margin: 0 0 3px;
            font-size: 18px;
        }
        .header p {
            margin: 0;
            color: #4b5563;
            font-size: 10px;
        }
        .header .total {
            text-align: right;
            min-width: 180px;
        }
        .header .total-label {
            color: #6b7280;
            font-size: 10px;
        }
        .header .total-value {
            font-size: 20px;
            font-weight: 800;
            color: #047857;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 6px;
            margin-bottom: 8px;
        }
        .summary-card {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 6px 8px;
            background: #f9fafb;
        }
        .summary-card .label {
            color: #6b7280;
            font-size: 9px;
            margin-bottom: 2px;
        }
        .summary-card .value {
            font-size: 14px;
            font-weight: 700;
        }
        .payment-line {
            margin: 4px 0 8px;
            color: #374151;
            font-size: 9px;
        }
        .section-title {
            margin: 8px 0 4px;
            font-size: 11px;
            font-weight: 700;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            page-break-inside: auto;
        }
        th, td {
            border: 1px solid #d1d5db;
            padding: 3px 4px;
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
            padding: 10px 8px;
        }
        .footer {
            margin-top: 6px;
            color: #6b7280;
            font-size: 8px;
            text-align: right;
        }
        .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        @media print {
            @page {
                size: A4 landscape;
                margin: 6mm;
            }
            .sheet { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="sheet">
    <div class="header">
        <div>
            <h1>${escapeHtml(stationName)}</h1>
            <p>รายงานสรุปการทำงานทั้งวัน วันที่ ${escapeHtml(formatReportDate(reportDate))}</p>
        </div>
        <div class="total">
            <div class="total-label">ยอดเงินทั้งหมดที่ได้</div>
            <div class="total-value">${escapeHtml(formatCurrency(totalAmount))} บาท</div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">จำนวนรายการ</div>
            <div class="value">${escapeHtml(sortedTransactions.length)}</div>
        </div>
        <div class="summary-card">
            <div class="label">ลิตรจากรายการเติม</div>
            <div class="value">${escapeHtml(formatCurrency(totalLiters))} ลิตร</div>
        </div>
        <div class="summary-card">
            <div class="label">ลิตรจากมิเตอร์</div>
            <div class="value">${escapeHtml(formatCurrency(totalMeterLiters))} ลิตร</div>
        </div>
        <div class="summary-card">
            <div class="label">ยอดเงินตามมิเตอร์</div>
            <div class="value">${escapeHtml(formatCurrency(totalMeterAmount))} บาท</div>
        </div>
    </div>

    <div class="payment-line">สรุปชำระ: ${escapeHtml(paymentSummaryText || '-')}</div>

    <div class="avoid-break">
    <div class="section-title">เลขเปิด-ปิดมิเตอร์</div>
    <table>
        <thead>
            <tr>
                <th class="text-center">หัว</th>
                <th>น้ำมัน</th>
                <th class="text-right">เลขเปิด</th>
                <th class="text-right">เลขปิด</th>
                <th class="text-right">ลิตร</th>
                <th class="text-right">ราคา</th>
                <th class="text-right">ยอดเงิน</th>
            </tr>
        </thead>
        <tbody>
            ${meterRows}
            <tr class="total-row">
                <td colspan="4">รวมมิเตอร์</td>
                <td class="text-right">${escapeHtml(formatCurrency(totalMeterLiters))}</td>
                <td></td>
                <td class="text-right">${escapeHtml(formatCurrency(totalMeterAmount))}</td>
            </tr>
        </tbody>
    </table>
    </div>

    <div class="section-title">รายการเติมทั้งหมด</div>
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
            </tr>
        </thead>
        <tbody>
            ${transactionRows}
            <tr class="total-row">
                <td colspan="6">รวมรายการเติมทั้งหมด</td>
                <td class="text-right">${escapeHtml(formatCurrency(totalLiters))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(totalAmount))}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <div class="footer">พิมพ์เมื่อ ${escapeHtml(new Date().toLocaleString('th-TH'))}</div>
    </div>

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
