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

export interface PrintDailyWorkReportInput {
    stationName: string;
    reportDate: string;
    transactions: PrintableDailyTransaction[];
    meters?: PrintableDailyMeter[];
}

export type ThermalPaperSize = '58' | '80';

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
const EPSON_THERMAL_TRANSACTION_COLUMNS: Record<ThermalPaperSize, number> = {
    '58': 40,
    '80': 56,
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

function formatShortReportDate(dateStr: string): string {
    const date = new Date(`${dateStr}T00:00:00+07:00`);
    if (Number.isNaN(date.getTime())) {
        return dateStr;
    }

    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });
}

function formatPrintedAt(date = new Date()): string {
    return date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
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

function buildReadableMeterGroups(
    meters: ReturnType<typeof buildDailyReportModel>['normalizedMeters'],
    columns: number,
): Array<{ title: string; readings: string[] }> {
    if (meters.length === 0) {
        return [{ title: 'ไม่พบเลขมิเตอร์', readings: [] }];
    }

    return meters.map((meter) => {
        const endReading = meter.endReading === null ? '-' : formatCurrency(meter.endReading);
        const headerText = `หัว ${meter.nozzleNumber}`;
        const litersText = `ขาย ${formatCurrency(meter.liters)}L`;

        return {
            title: padReceiptLine(headerText, litersText, columns),
            readings: [
                padReceiptLine('เปิด', formatCurrency(meter.startReading), columns),
                padReceiptLine('ปิด', endReading, columns),
            ],
        };
    });
}

function buildCompactTransactionLines(
    transaction: PrintableDailyTransaction,
    index: number,
    columns: number,
): string[] {
    const amount = formatCurrency(Number(transaction.amount || 0));
    const liters = `${formatCurrency(Number(transaction.liters || 0))}L`;
    const payment = getPaymentLabel(transaction.paymentType);
    const billText = transaction.billBookNo || transaction.billNo
        ? `${transaction.billBookNo || '-'}/${transaction.billNo || '-'}`
        : '';
    const plateAndOwner = [transaction.licensePlate || '-', transaction.ownerName || '']
        .filter(Boolean)
        .join(' ');
    const detailText = [plateAndOwner, payment, liters, billText ? `บิล ${billText}` : '']
        .filter(Boolean)
        .join(' ');

    return [
        padReceiptLine(`${index + 1}. ${formatTime(transaction.date)}`, amount, columns),
        truncateText(detailText, columns),
    ];
}

export function buildEpsonAssistantDailyReportXml({
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
    const transactionColumns = EPSON_THERMAL_TRANSACTION_COLUMNS[paperSize];
    const divider = '-'.repeat(columns);
    const doubleDivider = '='.repeat(columns);
    const focusLines = [
        padReceiptLine('รวมลิตรขาย', `${formatCurrency(totalLiters)}L`, columns),
        padReceiptLine('ลิตรตามมิเตอร์', `${formatCurrency(totalMeterLiters)}L`, columns),
        padReceiptLine('ผลต่าง', `${litersDiff > 0 ? '+' : ''}${formatCurrency(litersDiff)}L ${diffOk ? 'ตรง' : 'ตรวจสอบ'}`, columns),
    ];
    const detailLines = [padReceiptLine('จำนวนรายการ', String(sortedTransactions.length), columns)];

    const paymentEntries = Object.entries(paymentTotals)
        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'));

    const paymentLines: string[] = ['สรุปชำระ'];
    if (paymentEntries.length === 0) {
        paymentLines.push('ไม่มีรายการชำระ');
    } else {
        paymentEntries.forEach(([paymentType, total]) => {
            paymentLines.push(padReceiptLine(`${getPaymentLabel(paymentType)} (${total.count})`, formatCurrency(total.amount), columns));
            paymentLines.push(padReceiptLine('ลิตร', `${formatCurrency(total.liters)}L`, columns));
        });
    }

    const transactionLines: string[] = [];
    if (sortedTransactions.length === 0) {
        transactionLines.push('ไม่พบรายการเติม');
    } else {
        sortedTransactions.forEach((transaction, index) => {
            transactionLines.push(...buildCompactTransactionLines(transaction, index, transactionColumns));
        });
    }

    const meterGroups = buildReadableMeterGroups(normalizedMeters, columns);
    const footerTotalLines = [
        padReceiptLine('รวมลิตร', formatCurrency(totalLiters), columns),
        padReceiptLine('รวมเงิน', formatCurrency(totalAmount), columns),
    ];
    const footerPrintedAtLine = centerReceiptLine(`พิมพ์ ${formatPrintedAt()}`, columns);

    return [
        '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">',
        '<text lang="mul" />',
        '<text font="font_a" />',
        '<text smooth="true" />',
        '<text linespc="24" />',
        eposText(`${stationName}\n`, ' align="center"'),
        eposText(`รายงานสรุปวัน ${formatShortReportDate(reportDate)}\n`, ' align="center"'),
        eposText(`${doubleDivider}\n`, ' align="left"'),
        eposText(`ยอดรวม ฿ ${formatCurrency(totalAmount)}\n`, ' align="center"'),
        eposText(`${focusLines.join('\n')}\n`),
        '<text font="font_b" />',
        eposText(`${detailLines.join('\n')}\n`),
        '<text font="font_a" />',
        eposText(`${divider}\n`),
        eposText('เลขเปิด-ปิดมิเตอร์\n'),
        ...meterGroups.flatMap((meterGroup) => [
            eposText(`${meterGroup.title}\n`),
            meterGroup.readings.length > 0 ? eposText(`${meterGroup.readings.join('\n')}\n`) : '',
        ]),
        eposText(`${divider}\n`),
        '<text font="font_b" />',
        eposText(`${paymentLines.join('\n')}\n${divider}\n`),
        '<text font="font_a" />',
        eposText('รายการเติมทั้งหมด\n'),
        '<text font="font_b" />',
        eposText(`${transactionLines.join('\n')}\n`),
        '<text font="font_a" />',
        eposText(`${doubleDivider}\n`),
        eposText(`${footerTotalLines.join('\n')}\n`),
        '<text font="font_b" />',
        eposText(`${footerPrintedAtLine}\n`),
        '<feed line="1" />',
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

    const meterRows = normalizedMeters.length > 0
        ? normalizedMeters.map((meter) => `
            <tr>
                <td class="text-center font-bold">${escapeHtml(meter.nozzleNumber)}</td>
                <td>${escapeHtml(meter.fuelType || 'ดีเซล B7')}</td>
                <td class="text-right">${escapeHtml(formatCurrency(meter.startReading))}</td>
                <td class="text-right">${meter.endReading === null ? '-' : escapeHtml(formatCurrency(meter.endReading))}</td>
                <td class="text-right font-bold">${escapeHtml(formatCurrency(meter.liters))}</td>
                <td class="text-right">${escapeHtml(meter.price > 0 ? formatCurrency(meter.price) : '-')}</td>
                <td class="text-right font-bold">${meter.amount === null ? '-' : escapeHtml(formatCurrency(meter.amount))}</td>
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
                <td class="text-center font-bold">${escapeHtml(formatTime(transaction.date))}</td>
                <td class="text-center font-mono">${escapeHtml(transaction.billBookNo || '-')} / ${escapeHtml(transaction.billNo || '-')}</td>
                <td>${escapeHtml(transaction.licensePlate || '-')}</td>
                <td class="font-medium">${escapeHtml(transaction.ownerName || '-')}</td>
                <td>${escapeHtml(getFuelLabel(transaction.fuelType))}</td>
                <td class="text-right font-bold">${escapeHtml(formatCurrency(Number(transaction.liters || 0)))}</td>
                <td class="text-right font-bold text-orange-700">${escapeHtml(formatCurrency(Number(transaction.amount || 0)))}</td>
                <td class="text-center"><span class="badge badge-${transaction.paymentType}">${escapeHtml(getPaymentLabel(transaction.paymentType))}</span></td>
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Sarabun', 'Tahoma', sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 0;
            margin: 0;
            font-size: 8.5px;
            line-height: 1.3;
        }
        .sheet {
            padding: 5mm;
            max-width: 297mm;
            margin: 0 auto;
        }
        .header-compact {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-left: 5px solid #f97316;
            border-radius: 6px;
            background: #f8fafc;
        }
        .header-compact h1 {
            margin: 0 0 2px;
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
        }
        .header-compact p {
            margin: 0;
            color: #64748b;
            font-size: 9px;
            font-weight: 500;
        }
        .header-compact .total {
            text-align: right;
        }
        .header-compact .total-label {
            color: #64748b;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .header-compact .total-value {
            font-size: 20px;
            font-weight: 800;
            color: #f97316;
        }
        .dashboard-layout {
            display: flex;
            gap: 10px;
        }
        .left-col {
            flex: 4.3;
            display: flex;
            flex-direction: column;
            gap: 6px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .right-col {
            flex: 5.7;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
        }
        .stats-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
        }
        .stat-card {
            border: 1px solid #e2e8f0;
            border-top: 3px solid #cbd5e1;
            border-radius: 6px;
            padding: 4px 6px;
            background: #ffffff;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.01);
        }
        .stat-card.card-primary { border-top-color: #f97316; }
        .stat-card.card-success { border-top-color: #16a34a; }
        .stat-card.card-danger {
            border-top-color: #dc2626;
            background: #fef2f2;
        }
        .stat-card .label {
            color: #64748b;
            font-size: 8px;
            margin-bottom: 1px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .stat-card .value {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
        }
        .stat-card .value.text-success { color: #16a34a; }
        .stat-card .value.text-danger { color: #dc2626; }

        .payment-summary-container {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #f8fafc;
            padding: 5px 8px;
        }
        .payment-title {
            font-weight: 800;
            font-size: 8.5px;
            color: #334155;
            margin-bottom: 3px;
            display: block;
        }
        .payment-chips {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }
        .payment-chip {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 8px;
        }
        .chip-label {
            font-weight: 700;
            color: #1e293b;
        }
        .chip-count {
            color: #64748b;
            font-size: 7.5px;
        }
        .chip-value {
            font-weight: 800;
            color: #ea580c;
        }
        .chip-liters {
            font-weight: 600;
            color: #475569;
            border-left: 1px solid #e2e8f0;
            padding-left: 4px;
        }
        .reconcile-line {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 8px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .reconcile-line.ok {
            background: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        .reconcile-line.warn {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        .section-title {
            margin: 4px 0 2px;
            font-size: 9.5px;
            font-weight: 800;
            color: #0f172a;
            border-left: 3px solid #f97316;
            padding-left: 6px;
            line-height: 1.1;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
        }
        th, td {
            border-bottom: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            padding: 3px 4px;
            vertical-align: middle;
        }
        th:last-child, td:last-child {
            border-right: none;
        }
        th {
            background: #f1f5f9;
            color: #334155;
            text-align: left;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 500; }
        .font-mono { font-family: monospace; }
        .total-row {
            background: #fff7ed !important;
            font-weight: 800;
            color: #9a3412;
            border-top: 2px solid #ffedd5;
        }
        .total-row td {
            border-bottom: 2px solid #fdba74;
        }
        .empty-state {
            text-align: center;
            color: #64748b;
            padding: 8px;
            font-weight: 500;
        }
        .badge {
            display: inline-block;
            padding: 1px 4px;
            font-size: 7px;
            font-weight: 700;
            border-radius: 3px;
            text-transform: uppercase;
        }
        .badge-CASH { background: #e0f2fe; color: #0369a1; }
        .badge-CREDIT { background: #f3e8ff; color: #6b21a8; }
        .badge-TRANSFER { background: #dcfce7; color: #15803d; }
        .badge-CREDIT_CARD { background: #feeff0; color: #991b1b; }
        .badge-BOX_TRUCK { background: #fef3c7; color: #92400e; }
        .badge-OIL_TRUCK_SUPACHAI { background: #ffedd5; color: #c2410c; }
        .footer {
            margin-top: 6px;
            color: #94a3b8;
            font-size: 7.5px;
            text-align: right;
            border-top: 1px dashed #e2e8f0;
            padding-top: 4px;
        }
        @media print {
            @page {
                size: A4 landscape;
                margin: 4mm 5mm;
            }
            .sheet { padding: 0; }
            body { background: #ffffff; }
        }
    </style>
</head>
<body>
    <div class="sheet">
    <div class="header-compact">
        <div>
            <h1>${escapeHtml(stationName)}</h1>
            <p>รายงานสรุปการทำงานทั้งวัน ประจำวันที่ ${escapeHtml(formatReportDate(reportDate))}</p>
        </div>
        <div class="total">
            <div class="total-label">ยอดเงินรวมทั้งหมด</div>
            <div class="total-value">฿ ${escapeHtml(formatCurrency(totalAmount))}</div>
        </div>
    </div>

    <div class="dashboard-layout">
        <div class="left-col">
            <div class="stats-grid">
                <div class="stat-card card-primary">
                    <div class="label">จำนวนรายการเติม</div>
                    <div class="value">${escapeHtml(sortedTransactions.length)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">รวมปริมาณลิตร (เติม)</div>
                    <div class="value">${escapeHtml(formatCurrency(totalLiters))} L</div>
                </div>
                <div class="stat-card">
                    <div class="label">รวมปริมาณลิตร (มิเตอร์)</div>
                    <div class="value">${escapeHtml(formatCurrency(totalMeterLiters))} L</div>
                </div>
            </div>
            <div class="stats-grid-2">
                <div class="stat-card">
                    <div class="label">ยอดเงินตามมิเตอร์</div>
                    <div class="value">${hasMeterAmount ? `${escapeHtml(formatCurrency(totalMeterAmount))} ฿` : '-'}</div>
                </div>
                <div class="stat-card ${diffOk ? 'card-success' : 'card-danger'}">
                    <div class="label">ผลต่างลิตร (เติม - มิเตอร์)</div>
                    <div class="value ${diffOk ? 'text-success' : 'text-danger'}">
                        ${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))} L
                    </div>
                </div>
            </div>

            <div class="payment-summary-container">
                <span class="payment-title">สรุปการชำระเงิน</span>
                <div class="payment-chips">
                    ${Object.entries(paymentTotals)
                        .sort(([left], [right]) => getPaymentLabel(left).localeCompare(getPaymentLabel(right), 'th'))
                        .map(([paymentType, total]) => `
                            <div class="payment-chip">
                                <span class="chip-label">${escapeHtml(getPaymentLabel(paymentType))}</span>
                                <span class="chip-count">(${escapeHtml(total.count)} รายการ)</span>
                                <span class="chip-value">${escapeHtml(formatCurrency(total.amount))} ฿</span>
                                <span class="chip-liters">${escapeHtml(formatCurrency(total.liters))} L</span>
                            </div>
                        `).join('') || '<div class="payment-chip"><span class="chip-label">ไม่มีรายการชำระ</span></div>'}
                </div>
            </div>

            <div class="reconcile-line ${diffOk ? 'ok' : 'warn'}">
                <span>กระทบยอดมิเตอร์: ยอดเติม ${escapeHtml(formatCurrency(totalLiters))} L - มิเตอร์ ${escapeHtml(formatCurrency(totalMeterLiters))} L = <strong>${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))} L</strong> ${diffOk ? '(ยอดตรงกัน)' : '(ตรวจสอบด่วน)'}</span>
            </div>

            <div class="section-title">เลขเปิด-ปิดมิเตอร์ (Meter Readings)</div>
            <table>
                <thead>
                    <tr>
                        <th class="text-center" style="width: 8%">หัวจ่าย</th>
                        <th style="width: 20%">ประเภทน้ำมัน</th>
                        <th class="text-right" style="width: 17%">เปิด</th>
                        <th class="text-right" style="width: 17%">ปิด</th>
                        <th class="text-right" style="width: 12%">ลิตร</th>
                        <th class="text-right" style="width: 11%">ราคา/ลิตร</th>
                        <th class="text-right" style="width: 15%">รวมเงิน (บาท)</th>
                    </tr>
                </thead>
                <tbody>
                    ${meterRows}
                    <tr class="total-row">
                        <td colspan="4">รวมยอดจากมิเตอร์ทั้งหมด</td>
                        <td class="text-right">${escapeHtml(formatCurrency(totalMeterLiters))} L</td>
                        <td></td>
                        <td class="text-right">${hasMeterAmount ? `${escapeHtml(formatCurrency(totalMeterAmount))} ฿` : '-'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="right-col">
            <div class="section-title">รายการเติมเงินทั้งหมด (Transactions)</div>
            <table>
                <thead>
                    <tr>
                        <th class="text-center" style="width: 5%">ลำดับ</th>
                        <th class="text-center" style="width: 7%">เวลา</th>
                        <th class="text-center" style="width: 12%">เล่ม / เลขบิล</th>
                        <th style="width: 10%">ทะเบียน</th>
                        <th style="width: 20%">ชื่อลูกค้า / สังกัด</th>
                        <th style="width: 12%">น้ำมัน</th>
                        <th class="text-right" style="width: 10%">ลิตร</th>
                        <th class="text-right" style="width: 12%">ยอดเงิน (บาท)</th>
                        <th class="text-center" style="width: 12%">ชำระเงิน</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactionRows}
                    <tr class="total-row">
                        <td colspan="6">รวมยอดจากรายการทั้งหมด</td>
                        <td class="text-right">${escapeHtml(formatCurrency(totalLiters))} L</td>
                        <td class="text-right">${escapeHtml(formatCurrency(totalAmount))} ฿</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">รายงานสรุปวัน • พิมพ์เมื่อ ${escapeHtml(formatPrintedAt())}</div>
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
            <div class="payment-item">
                <div class="line-row">
                    <span class="font-bold">${escapeHtml(getPaymentLabel(paymentType))} (${escapeHtml(total.count)} รายการ)</span>
                    <strong class="font-bold">${escapeHtml(formatCurrency(total.amount))} ฿</strong>
                </div>
                <div class="line-row small muted" style="margin-top: 1px;">
                    <span>ปริมาณน้ำมัน</span>
                    <span>${escapeHtml(formatCurrency(total.liters))} L</span>
                </div>
            </div>
        `).join('');

    const meterRows = normalizedMeters.length > 0
        ? `
        <table class="thermal-table">
            <thead>
                <tr>
                    <th style="width: 15%; text-align: left;">หัว</th>
                    <th style="width: 32%; text-align: right;">เปิด</th>
                    <th style="width: 32%; text-align: right;">ปิด</th>
                    <th style="width: 21%; text-align: right;">ลิตร</th>
                </tr>
            </thead>
            <tbody>
                ${normalizedMeters.map((meter) => `
                    <tr>
                        <td colspan="4" class="nozzle-desc">หัว ${escapeHtml(meter.nozzleNumber)}</td>
                    </tr>
                    <tr class="reading-row">
                        <td class="bullet-sub">└─</td>
                        <td class="text-right">${escapeHtml(formatCurrency(meter.startReading))}</td>
                        <td class="text-right">${meter.endReading === null ? '-' : escapeHtml(formatCurrency(meter.endReading))}</td>
                        <td class="text-right font-bold">${escapeHtml(formatCurrency(meter.liters))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        `
        : '<div class="empty">ไม่พบเลขมิเตอร์</div>';

    const transactionRows = sortedTransactions.length > 0
        ? sortedTransactions.map((transaction, index) => {
            const billText = transaction.billBookNo || transaction.billNo
                ? `${transaction.billBookNo || '-'}/${transaction.billNo || '-'}`
                : '';
            const plateAndOwner = [transaction.licensePlate || '-', transaction.ownerName || '']
                .filter(Boolean)
                .join(' • ');
            return `
                <div class="txn-row">
                    <div class="txn-header-line">
                        <span class="txn-index-time">${index + 1}. ${escapeHtml(formatTime(transaction.date))}</span>
                        <span class="txn-amount font-bold">฿${escapeHtml(formatCurrency(Number(transaction.amount || 0)))}</span>
                    </div>
                    <div class="txn-details-line">
                        <span class="txn-vehicle">${escapeHtml(plateAndOwner)}</span>
                        <span class="txn-payment-type font-bold">${escapeHtml(getPaymentLabel(transaction.paymentType))}</span>
                    </div>
                    <div class="txn-volume-bill">
                        <span>${escapeHtml(formatCurrency(Number(transaction.liters || 0)))} L</span>
                        ${billText ? `<span class="txn-bill-no">บิล: ${escapeHtml(billText)}</span>` : '<span>-</span>'}
                    </div>
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
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
            padding: ${isCompact ? '2.5mm 1mm' : '3.5mm 1.5mm'};
            font-size: ${isCompact ? '9px' : '10.5px'};
            line-height: 1.3;
        }
        .center { text-align: center; }
        .brand {
            font-weight: 800;
            font-size: ${isCompact ? '13px' : '15px'};
            line-height: 1.2;
            margin-bottom: 2px;
            letter-spacing: 0.2px;
        }
        .doc-title {
            margin: 4px auto;
            font-weight: 800;
            font-size: ${isCompact ? '10px' : '12px'};
            border: 1px solid #000;
            display: inline-block;
            padding: 1px 6px;
            letter-spacing: 0.5px;
        }
        .muted { color: #555; }
        .small { font-size: ${isCompact ? '8px' : '9px'}; }
        .font-bold { font-weight: 700; }
        .dline {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            height: 3px;
            margin: 6px 0;
        }
        .sline {
            border-top: 1px solid #000;
            margin: 6px 0;
        }
        .dash {
            border-top: 1px dashed #000;
            margin: 6px 0;
        }
        .line-row {
            display: flex;
            justify-content: space-between;
            gap: 6px;
        }
        .line-row span:last-child {
            text-align: right;
            white-space: nowrap;
        }
        .total-box {
            border: 1px dashed #000;
            padding: 6px 4px;
            margin: 6px 0;
            text-align: center;
        }
        .total-label {
            font-size: ${isCompact ? '8.5px' : '9.5px'};
            font-weight: 500;
            text-transform: uppercase;
        }
        .total-value {
            font-size: ${isCompact ? '17px' : '20px'};
            font-weight: 800;
            margin-top: 1px;
        }
        .section-title {
            font-weight: 800;
            font-size: ${isCompact ? '9.5px' : '11px'};
            margin: 10px 0 4px 0;
            text-transform: uppercase;
            border-left: 3px solid #000;
            padding-left: 5px;
            line-height: 1.1;
        }
        .reconcile-badge {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 5px;
            margin: 6px 0;
            font-weight: 700;
            font-size: ${isCompact ? '9px' : '10.5px'};
            border: 1px solid #000;
        }
        .reconcile-badge.ok {
            background-color: #f3f4f6;
        }
        .reconcile-badge.warn {
            background-color: #000;
            color: #fff;
        }
        .status-text {
            font-weight: 800;
        }
        .payment-item {
            padding: 3px 0;
            border-bottom: 1px dotted #ccc;
        }
        .payment-item:last-child {
            border-bottom: none;
        }
        .thermal-table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${isCompact ? '8px' : '9.5px'};
            margin-top: 4px;
        }
        .thermal-table th {
            border-bottom: 1px solid #000;
            font-weight: 700;
            padding: 2px 0;
            text-transform: uppercase;
        }
        .thermal-table td {
            padding: 2px 0;
            vertical-align: middle;
        }
        .nozzle-desc {
            font-weight: 700;
            padding-top: 4px !important;
        }
        .reading-row td {
            font-size: ${isCompact ? '10.5px' : '12.5px'} !important;
        }
        .bullet-sub {
            color: #555;
            padding-left: 2px !important;
        }
        .text-right {
            text-align: right;
        }
        .txn-row {
            padding: 5px 0;
            border-bottom: 1px dotted #bbb;
        }
        .txn-row:last-child {
            border-bottom: none;
        }
        .txn-header-line {
            display: flex;
            justify-content: space-between;
            font-weight: 700;
        }
        .txn-details-line {
            display: flex;
            justify-content: space-between;
            font-size: ${isCompact ? '8px' : '9px'};
            color: #333;
            margin-top: 1px;
        }
        .txn-volume-bill {
            display: flex;
            justify-content: space-between;
            font-size: ${isCompact ? '8px' : '9px'};
            color: #555;
            margin-top: 1px;
        }
        .footer {
            margin-top: 12px;
            text-align: center;
            font-size: ${isCompact ? '7.5px' : '8.5px'};
            color: #555;
            border-top: 1px dashed #000;
            padding-top: 8px;
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
        <div class="total-box">
            <div class="total-label">ยอดเงินรวมทั้งหมด</div>
            <div class="total-value">฿ ${escapeHtml(formatCurrency(totalAmount))}</div>
        </div>
        
        <div class="line-row"><span>จำนวนรายการเติม</span><strong>${escapeHtml(sortedTransactions.length)}</strong></div>
        <div class="line-row"><span>รวมปริมาณลิตร (เติม)</span><strong>${escapeHtml(formatCurrency(totalLiters))} L</strong></div>
        <div class="line-row"><span>รวมปริมาณลิตร (มิเตอร์)</span><strong>${escapeHtml(formatCurrency(totalMeterLiters))} L</strong></div>
        
        <div class="reconcile-badge ${diffOk ? 'ok' : 'warn'}">
            <span>ผลต่าง: ${litersDiff > 0 ? '+' : ''}${escapeHtml(formatCurrency(litersDiff))} L</span>
            <span class="status-text">${diffOk ? '✓ ตรง' : '✗ ตรวจสอบ'}</span>
        </div>

        <div class="dash"></div>
        <div class="section-title">สรุปการชำระเงิน</div>
        ${paymentRows || '<div class="empty">ไม่มีรายการชำระ</div>'}

        <div class="dash"></div>
        <div class="section-title">เลขเปิด-ปิดมิเตอร์</div>
        ${meterRows}

        <div class="dash"></div>
        <div class="section-title">รายการเติมทั้งหมด</div>
        ${transactionRows}

        <div class="dline"></div>
        <div class="line-row">
            <span>รวมปริมาณลิตรทั้งหมด</span>
            <strong>${escapeHtml(formatCurrency(totalLiters))} L</strong>
        </div>
        <div class="line-row">
            <span>รวมยอดเงินทั้งหมด</span>
            <strong>฿ ${escapeHtml(formatCurrency(totalAmount))}</strong>
        </div>
        <div class="footer">พิมพ์เมื่อ ${escapeHtml(formatPrintedAt())}<br/>ขอบคุณที่ใช้บริการ</div>
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
