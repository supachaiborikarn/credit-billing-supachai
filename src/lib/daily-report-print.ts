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

type ThermalPaperSize = '58' | '80';

const THERMAL_DAILY_PRINTER_PROFILE = {
    model: 'Epson TM-m30III',
    paperWidthMm: { '58': 58, '80': 80 } as Record<ThermalPaperSize, number>,
    printableWidthMm: { '58': 52.5, '80': 72 } as Record<ThermalPaperSize, number>,
};

const EPSON_TM_PRINT_ASSISTANT_URL = 'tmprintassistant://tmprintassistant.epson.com/print';
const EPSON_TM_PRINT_ASSISTANT_MAX_URL_LENGTH = 190_000;
const EPSON_THERMAL_COLUMNS: Record<ThermalPaperSize, number> = {
    '58': 32,
    '80': 42,
};

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

function isAndroidDevice(): boolean {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

function getTextLength(value: string): number {
    return Array.from(value).length;
}

function truncateText(value: string, maxLength: number): string {
    const chars = Array.from(value);
    if (chars.length <= maxLength) {
        return value;
    }

    if (maxLength <= 3) {
        return chars.slice(0, maxLength).join('');
    }

    return `${chars.slice(0, maxLength - 3).join('')}...`;
}

function padReceiptLine(leftValue: string, rightValue: string, columns: number): string {
    const left = leftValue.replace(/\s+/g, ' ').trim();
    const right = rightValue.replace(/\s+/g, ' ').trim();
    const rightLength = getTextLength(right);
    const maxLeftLength = Math.max(1, columns - rightLength - 1);
    const clippedLeft = truncateText(left, maxLeftLength);
    const spaces = Math.max(1, columns - getTextLength(clippedLeft) - rightLength);

    return `${clippedLeft}${' '.repeat(spaces)}${right}`;
}

function centerReceiptLine(value: string, columns: number): string {
    const clipped = truncateText(value.replace(/\s+/g, ' ').trim(), columns);
    const sidePadding = Math.max(0, Math.floor((columns - getTextLength(clipped)) / 2));

    return `${' '.repeat(sidePadding)}${clipped}`;
}

function escapeXml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function eposText(value: string, attributes = ''): string {
    const escapedValue = escapeXml(value).replaceAll('\n', '&#10;');
    return `<text${attributes}>${escapedValue}</text>`;
}

function buildEpsonAssistantDailyReportXml({
    stationName,
    reportDate,
    transactions,
    meters,
    paperSize,
}: PrintDailyWorkReportInput & { paperSize: ThermalPaperSize }): string {
    const {
        sortedTransactions,
        totalLiters,
        totalAmount,
        normalizedMeters,
        totalMeterLiters,
        litersDiff,
        diffOk,
        paymentTotals,
    } = buildDailyReportModel(transactions, meters || []);

    const columns = EPSON_THERMAL_COLUMNS[paperSize];
    const divider = '-'.repeat(columns);
    const doubleDivider = '='.repeat(columns);
    const lines: string[] = [
        centerReceiptLine(stationName, columns),
        centerReceiptLine('รายงานสรุปวัน', columns),
        centerReceiptLine(formatReportDate(reportDate), columns),
        centerReceiptLine(`${THERMAL_DAILY_PRINTER_PROFILE.model} ${paperSize}mm`, columns),
        doubleDivider,
        centerReceiptLine('ยอดเงินทั้งหมด', columns),
        centerReceiptLine(`฿ ${formatCurrency(totalAmount)}`, columns),
        divider,
        padReceiptLine('จำนวนรายการ', String(sortedTransactions.length), columns),
        padReceiptLine('ลิตรจากรายการเติม', formatCurrency(totalLiters), columns),
        padReceiptLine('ลิตรจากมิเตอร์', formatCurrency(totalMeterLiters), columns),
        padReceiptLine('ผลต่างลิตร', `${litersDiff > 0 ? '+' : ''}${formatCurrency(litersDiff)}`, columns),
        centerReceiptLine(diffOk ? 'กระทบยอดตรง' : 'ตรวจสอบผลต่าง', columns),
        divider,
        'สรุปชำระ',
    ];

    const paymentEntries = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'));

    if (paymentEntries.length === 0) {
        lines.push('ไม่มีรายการชำระ');
    } else {
        paymentEntries.forEach(([paymentType, total]) => {
            lines.push(padReceiptLine(`${getPaymentLabel(paymentType)} (${total.count})`, formatCurrency(total.amount), columns));
        });
    }

    lines.push(divider, 'เลขเปิด-ปิดมิเตอร์');

    if (normalizedMeters.length === 0) {
        lines.push('ไม่พบเลขมิเตอร์');
    } else {
        normalizedMeters.forEach((meter) => {
            lines.push(`หัว ${meter.nozzleNumber} ${truncateText(meter.fuelType || 'ดีเซล B7', Math.max(8, columns - 6))}`);
            lines.push(padReceiptLine('เปิด', formatCurrency(meter.startReading), columns));
            lines.push(padReceiptLine('ปิด', meter.endReading === null ? '-' : formatCurrency(meter.endReading), columns));
            lines.push(padReceiptLine('ลิตร', formatCurrency(meter.liters), columns));
        });
    }

    lines.push(divider, 'รายการเติมทั้งหมด');

    if (sortedTransactions.length === 0) {
        lines.push('ไม่พบรายการเติม');
    } else {
        sortedTransactions.forEach((transaction, index) => {
            const billText = transaction.billBookNo || transaction.billNo
                ? `${transaction.billBookNo || '-'} / ${transaction.billNo || '-'}`
                : '-';
            const title = `${index + 1}. ${formatTime(transaction.date)} ${transaction.licensePlate || '-'}`;

            lines.push(truncateText(title, columns));
            lines.push(padReceiptLine(getPaymentLabel(transaction.paymentType), formatCurrency(Number(transaction.amount || 0)), columns));
            lines.push(padReceiptLine('ลิตร', formatCurrency(Number(transaction.liters || 0)), columns));
            lines.push(truncateText(`ลูกค้า ${transaction.ownerName || '-'}`, columns));
            lines.push(truncateText(`บิล ${billText}`, columns));
        });
    }

    lines.push(
        doubleDivider,
        padReceiptLine('รวมลิตร', formatCurrency(totalLiters), columns),
        padReceiptLine('รวมเงิน', formatCurrency(totalAmount), columns),
        centerReceiptLine(`พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`, columns),
    );

    return [
        '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">',
        '<text lang="mul" />',
        '<text font="font_a" />',
        '<text smooth="true" />',
        '<text linespc="32" />',
        eposText(`${lines.join('\n')}\n`),
        '<feed line="3" />',
        '<cut type="feed" />',
        '</epos-print>',
    ].join('');
}

export function buildEpsonAssistantDailyReportUrl(
    input: PrintDailyWorkReportInput & { paperSize: ThermalPaperSize },
): string | null {
    const xml = buildEpsonAssistantDailyReportXml(input);
    const url = `${EPSON_TM_PRINT_ASSISTANT_URL}?ver=1&data-type=eposprintxml&data=${encodeURIComponent(xml)}`;

    if (url.length > EPSON_TM_PRINT_ASSISTANT_MAX_URL_LENGTH) {
        return null;
    }

    return url;
}

function printViaEpsonTmAssistant(input: PrintDailyWorkReportInput & { paperSize: ThermalPaperSize }): boolean {
    if (!isAndroidDevice()) {
        return false;
    }

    const assistantUrl = buildEpsonAssistantDailyReportUrl(input);
    if (!assistantUrl) {
        return false;
    }

    window.location.href = assistantUrl;
    return true;
}

function buildDailyReportModel(transactions: PrintableDailyTransaction[], meters: PrintableDailyMeter[]) {
    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const totalLiters = sortedTransactions.reduce((sum, transaction) => sum + Number(transaction.liters || 0), 0);
    const totalAmount = sortedTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const normalizedMeters = [...meters]
        .sort((a, b) => a.nozzleNumber - b.nozzleNumber)
        .map((meter) => {
            const startReading = Number(meter.startReading || 0);
            const hasEndReading = meter.endReading !== null && meter.endReading !== undefined && Number(meter.endReading) > 0;
            const endReading = hasEndReading ? Number(meter.endReading) : null;
            const liters = Number(meter.liters ?? (endReading === null ? 0 : Math.max(endReading - startReading, 0)));
            const price = Number(meter.price || 0);
            const hasAmount = (meter.amount !== null && meter.amount !== undefined) || price > 0;
            const amount = hasAmount ? Number(meter.amount ?? liters * price) : null;

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
    const totalMeterAmount = normalizedMeters.reduce((sum, meter) => sum + (meter.amount || 0), 0);
    const hasMeterAmount = normalizedMeters.some((meter) => meter.amount !== null);
    const litersDiff = totalLiters - totalMeterLiters;
    const diffOk = Math.abs(litersDiff) <= 1;
    const paymentTotals = sortedTransactions.reduce<Record<string, { amount: number; liters: number; count: number }>>((totals, transaction) => {
        const current = totals[transaction.paymentType] || { amount: 0, liters: 0, count: 0 };
        totals[transaction.paymentType] = {
            amount: current.amount + Number(transaction.amount || 0),
            liters: current.liters + Number(transaction.liters || 0),
            count: current.count + 1,
        };
        return totals;
    }, {});

    return {
        sortedTransactions,
        totalLiters,
        totalAmount,
        normalizedMeters,
        totalMeterLiters,
        totalMeterAmount,
        hasMeterAmount,
        litersDiff,
        diffOk,
        paymentTotals,
    };
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

    const {
        sortedTransactions,
        totalLiters,
        totalAmount,
        normalizedMeters,
        totalMeterLiters,
        totalMeterAmount,
        hasMeterAmount,
        litersDiff,
        diffOk,
        paymentTotals,
    } = buildDailyReportModel(transactions, meters);

    const paymentSummaryText = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'))
        .map(([paymentType, total]) => `${getPaymentLabel(paymentType)} ${formatCurrency(total.amount)}`)
        .join(' | ');

    const meterRows = normalizedMeters.length > 0
        ? normalizedMeters.map((meter) => `
            <tr>
                <td class="text-center">${escapeHtml(meter.nozzleNumber)}</td>
                <td>${escapeHtml(meter.fuelType || 'ดีเซล B7')}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.startReading))}</td>
                <td class="text-right">${meter.endReading === null ? '-' : escapeHtml(formatCurrency(meter.endReading))}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.liters))}</td>
                <td class="text-right">${escapeHtml(meter.price > 0 ? formatCurrency(meter.price) : '-')}</td>
                <td class="text-right">${meter.amount === null ? '-' : escapeHtml(formatCurrency(meter.amount))}</td>
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
            grid-template-columns: repeat(5, minmax(0, 1fr));
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
        .reconcile-line {
            margin: 0 0 8px;
            padding: 5px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
        }
        .reconcile-line.ok {
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }
        .reconcile-line.warn {
            background: #fef2f2;
            color: #b91c1c;
            border: 1px solid #fecaca;
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
            <div class="value">${hasMeterAmount ? `${escapeHtml(formatCurrency(totalMeterAmount))} บาท` : '-'}</div>
        </div>
        <div class="summary-card">
            <div class="label">ผลต่างลิตร</div>
            <div class="value">${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))}</div>
        </div>
    </div>

    <div class="payment-line">สรุปชำระ: ${escapeHtml(paymentSummaryText || '-')}</div>
    <div class="reconcile-line ${diffOk ? 'ok' : 'warn'}">
        กระทบยอดมิเตอร์: รายการเติม ${escapeHtml(formatCurrency(totalLiters))} ลิตร - มิเตอร์ ${escapeHtml(formatCurrency(totalMeterLiters))} ลิตร = ${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))} ลิตร ${diffOk ? '(ตรงกัน)' : '(มีผลต่าง)'}
    </div>

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
                <td class="text-right">${hasMeterAmount ? escapeHtml(formatCurrency(totalMeterAmount)) : '-'}</td>
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

export function printThermalDailyWorkReport({
    stationName,
    reportDate,
    transactions,
    meters = [],
    paperSize,
}: PrintDailyWorkReportInput & { paperSize: ThermalPaperSize }): boolean {
    const epsonAssistantOpened = printViaEpsonTmAssistant({
        stationName,
        reportDate,
        transactions,
        meters,
        paperSize,
    });

    if (epsonAssistantOpened) {
        return true;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return false;
    }

    const {
        sortedTransactions,
        totalLiters,
        totalAmount,
        normalizedMeters,
        totalMeterLiters,
        litersDiff,
        diffOk,
        paymentTotals,
    } = buildDailyReportModel(transactions, meters);

    const paperWidthMm = THERMAL_DAILY_PRINTER_PROFILE.paperWidthMm[paperSize];
    const printableWidthMm = THERMAL_DAILY_PRINTER_PROFILE.printableWidthMm[paperSize];
    const isCompact = paperSize === '58';

    const paymentRows = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'))
        .map(([paymentType, total]) => `
            <div class="line-row">
                <span>${escapeHtml(getPaymentLabel(paymentType))} (${escapeHtml(total.count)})</span>
                <span>${escapeHtml(formatCurrency(total.amount))}</span>
            </div>
        `).join('');

    const meterRows = normalizedMeters.length > 0
        ? normalizedMeters.map((meter) => `
            <div class="meter-row">
                <div class="row-title">หัว ${escapeHtml(meter.nozzleNumber)} ${escapeHtml(meter.fuelType || 'ดีเซล B7')}</div>
                <div class="line-row small"><span>เปิด</span><span>${escapeHtml(formatCurrency(meter.startReading))}</span></div>
                <div class="line-row small"><span>ปิด</span><span>${meter.endReading === null ? '-' : escapeHtml(formatCurrency(meter.endReading))}</span></div>
                <div class="line-row small"><span>ลิตร</span><span>${escapeHtml(formatCurrency(meter.liters))}</span></div>
            </div>
        `).join('')
        : '<div class="empty">ไม่พบเลขมิเตอร์</div>';

    const transactionRows = sortedTransactions.length > 0
        ? sortedTransactions.map((transaction, index) => {
            const billText = transaction.billBookNo || transaction.billNo
                ? `${transaction.billBookNo || '-'} / ${transaction.billNo || '-'}`
                : '-';
            return `
                <div class="txn-row">
                    <div class="txn-head">
                        <span>${index + 1}. ${escapeHtml(formatTime(transaction.date))}</span>
                        <strong>${escapeHtml(formatCurrency(Number(transaction.amount || 0)))}</strong>
                    </div>
                    <div class="small muted">${escapeHtml(transaction.licensePlate || '-')} • ${escapeHtml(transaction.ownerName || '-')}</div>
                    <div class="line-row small">
                        <span>${escapeHtml(formatCurrency(Number(transaction.liters || 0)))} ลิตร</span>
                        <span>${escapeHtml(getPaymentLabel(transaction.paymentType))}</span>
                    </div>
                    <div class="small muted">บิล ${escapeHtml(billText)}</div>
                </div>
            `;
        }).join('')
        : '<div class="empty">ไม่พบรายการเติม</div>';

    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8" />
    <title>สรุปวัน Thermal ${paperSize}mm - ${escapeHtml(stationName)}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: 'Sarabun', 'Tahoma', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .receipt {
            width: ${printableWidthMm}mm;
            margin: 0 auto;
            padding: ${isCompact ? '2.5mm 1.2mm' : '3.5mm 2mm'};
            font-size: ${isCompact ? '9px' : '11px'};
            line-height: 1.25;
        }
        .center { text-align: center; }
        .brand {
            font-weight: 800;
            font-size: ${isCompact ? '13px' : '16px'};
            line-height: 1.15;
        }
        .doc-title {
            margin-top: 2px;
            font-weight: 800;
            font-size: ${isCompact ? '11px' : '13px'};
        }
        .muted { color: #444; }
        .small { font-size: ${isCompact ? '8px' : '9.5px'}; }
        .dline {
            border-top: 3px double #000;
            margin: ${isCompact ? '5px' : '7px'} 0;
        }
        .line {
            border-top: 1px solid #000;
            margin: ${isCompact ? '5px' : '7px'} 0;
        }
        .dash {
            border-top: 1px dashed #000;
            margin: ${isCompact ? '5px' : '7px'} 0;
        }
        .line-row,
        .txn-head {
            display: flex;
            justify-content: space-between;
            gap: 6px;
        }
        .line-row span:last-child,
        .txn-head strong {
            text-align: right;
            white-space: nowrap;
        }
        .total-box {
            padding: ${isCompact ? '5px 0' : '7px 0'};
        }
        .total-value {
            font-size: ${isCompact ? '15px' : '19px'};
            font-weight: 900;
        }
        .section-title {
            font-weight: 800;
            margin-bottom: 3px;
        }
        .reconcile {
            padding: 4px 0;
            font-weight: 800;
        }
        .meter-row,
        .txn-row {
            padding: ${isCompact ? '4px 0' : '5px 0'};
            border-bottom: 1px dashed #777;
        }
        .row-title {
            font-weight: 700;
            margin-bottom: 2px;
        }
        .empty {
            text-align: center;
            color: #555;
            padding: 8px 0;
        }
        .footer {
            margin-top: 8px;
            text-align: center;
            font-size: ${isCompact ? '8px' : '9px'};
        }
        @media print {
            @page {
                size: ${paperWidthMm}mm 297mm;
                margin: 0;
            }
            body { width: ${paperWidthMm}mm; }
            .receipt {
                width: ${printableWidthMm}mm !important;
                margin-left: auto !important;
                margin-right: auto !important;
            }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="center">
            <div class="brand">${escapeHtml(stationName)}</div>
            <div class="doc-title">รายงานสรุปวัน</div>
            <div class="small muted">${escapeHtml(formatReportDate(reportDate))}</div>
            <div class="small muted">${escapeHtml(THERMAL_DAILY_PRINTER_PROFILE.model)} • ${escapeHtml(paperSize)}mm</div>
        </div>

        <div class="dline"></div>
        <div class="total-box center">
            <div class="small muted">ยอดเงินทั้งหมด</div>
            <div class="total-value">฿ ${escapeHtml(formatCurrency(totalAmount))}</div>
        </div>
        <div class="line-row"><span>จำนวนรายการ</span><strong>${escapeHtml(sortedTransactions.length)}</strong></div>
        <div class="line-row"><span>ลิตรจากรายการเติม</span><strong>${escapeHtml(formatCurrency(totalLiters))}</strong></div>
        <div class="line-row"><span>ลิตรจากมิเตอร์</span><strong>${escapeHtml(formatCurrency(totalMeterLiters))}</strong></div>
        <div class="reconcile">
            ผลต่าง: ${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))} ลิตร ${diffOk ? '(ตรง)' : '(ตรวจสอบ)'}
        </div>

        <div class="dash"></div>
        <div class="section-title">สรุปชำระ</div>
        ${paymentRows || '<div class="empty">ไม่มีรายการชำระ</div>'}

        <div class="dash"></div>
        <div class="section-title">เลขเปิด-ปิดมิเตอร์</div>
        ${meterRows}

        <div class="dash"></div>
        <div class="section-title">รายการเติมทั้งหมด</div>
        ${transactionRows}

        <div class="dline"></div>
        <div class="line-row">
            <span>รวมลิตร</span>
            <strong>${escapeHtml(formatCurrency(totalLiters))}</strong>
        </div>
        <div class="line-row">
            <span>รวมเงิน</span>
            <strong>${escapeHtml(formatCurrency(totalAmount))}</strong>
        </div>
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
