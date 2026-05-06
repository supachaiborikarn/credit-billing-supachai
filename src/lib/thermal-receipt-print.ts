export type ReceiptDocType = 'receipt' | 'credit';
export type PaperSize = '58' | '80';

export const PRINTER_PROFILE = {
    model: 'Epson TM-m30III',
    recommendedPaper: '80' as PaperSize,
    paperWidthMm: { '58': 58, '80': 80 } as Record<PaperSize, number>,
    printableWidthMm: { '58': 52.5, '80': 72 } as Record<PaperSize, number>,
    textColumns: { '58': 30, '80': 42 } as Record<PaperSize, number>,
    leftPaddingColumns: { '58': 2, '80': 3 } as Record<PaperSize, number>,
};

const EPSON_TM_PRINT_ASSISTANT_URL = 'tmprintassistant://tmprintassistant.epson.com/print';
const EPSON_TM_PRINT_ASSISTANT_MAX_URL_LENGTH = 190_000;

export interface ReceiptTransaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo: string;
    billNo: string;
    createdAt: string;
    recordedBy?: { name: string };
}

export interface ReceiptConfig {
    name: string;
    address1: string;
    address2: string;
    tel: string;
}

export const RECEIPT_CONFIG: Record<string, ReceiptConfig> = {
    'station-1': { name: 'วัชรเกียรติออยล์', address1: '657 ถ.เจริญสุข ต.ในเมือง อ.เมือง', address2: 'จ.กำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-2': { name: 'หจก.วัชรเกียรติออยล์', address1: '657 ถ.เจริญสุข ต.ในเมือง อ.เมือง', address2: 'จ.กำแพงเพชร 62000', tel: '055-773003' },
    'station-3': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-4': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-5': { name: 'ปั๊มแก๊สพงษ์อนันต์', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585' },
    'station-6': { name: 'ปั๊มแก๊สศุภชัย', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585' },
};

export const FUEL_LABELS: Record<string, string> = {
    DIESEL: 'ดีเซล B7',
    POWER_DIESEL: 'พาวเวอร์ดีเซล',
    GASOHOL_91: 'แก๊สโซฮอล์ 91',
    GASOHOL_95: 'แก๊สโซฮอล์ 95',
    GASOLINE_95: 'เบนซิน 95',
    GASOHOL_E20: 'E20',
    LPG: 'แก๊ส LPG',
    ENGINE_OIL: 'น้ำมันเครื่อง/สินค้า',
    COOLANT: 'น้ำยาหล่อเย็น',
    OTHER_PRODUCT: 'สินค้าอื่นๆ',
};

export const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    CREDIT_CARD: 'บัตรเครดิต',
    BOX_TRUCK: 'รถตู้ทึบ',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
};

function isAndroidDevice(): boolean {
    return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
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

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatReceiptDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatReceiptTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function textLength(value: string): number {
    return Array.from(value).length;
}

function truncateText(value: string, maxLength: number): string {
    const chars = Array.from(value.replace(/\s+/g, ' ').trim());
    if (chars.length <= maxLength) {
        return chars.join('');
    }

    if (maxLength <= 3) {
        return chars.slice(0, maxLength).join('');
    }

    return `${chars.slice(0, maxLength - 3).join('')}...`;
}

function padReceiptLine(leftValue: string, rightValue: string, columns: number): string {
    const left = leftValue.replace(/\s+/g, ' ').trim();
    const right = rightValue.replace(/\s+/g, ' ').trim();
    const maxLeftLength = Math.max(1, columns - textLength(right) - 1);
    const clippedLeft = truncateText(left, maxLeftLength);
    const spaces = Math.max(1, columns - textLength(clippedLeft) - textLength(right));

    return `${clippedLeft}${' '.repeat(spaces)}${right}`;
}

function centerReceiptLine(value: string, columns: number): string {
    const clipped = truncateText(value, columns);
    const sidePadding = Math.max(0, Math.floor((columns - textLength(clipped)) / 2));

    return `${' '.repeat(sidePadding)}${clipped}`;
}

function insetReceiptText(value: string, paperSize: PaperSize): string {
    const leftPadding = ' '.repeat(PRINTER_PROFILE.leftPaddingColumns[paperSize]);

    return value
        .split('\n')
        .map((line) => (line ? `${leftPadding}${line}` : line))
        .join('\n');
}

function buildReceiptCopyText({
    txn,
    config,
    docNo,
    copyType,
    docType,
    paperSize,
}: BuildReceiptPrintInput & { copyType: 'ต้นฉบับ' | 'สำเนา' }): string {
    const columns = PRINTER_PROFILE.textColumns[paperSize];
    const divider = '-'.repeat(columns);
    const doubleDivider = '='.repeat(columns);
    const receiptDate = txn.createdAt || txn.date;
    const paymentLabel = PAYMENT_LABELS[txn.paymentType] || txn.paymentType;
    const documentTitle = docType === 'credit' ? 'บิลเงินเชื่อ / ใบส่งของ' : 'ใบเสร็จรับเงิน';
    const itemLabel = FUEL_LABELS[txn.fuelType] || txn.fuelType || 'สินค้าอื่นๆ';
    const itemDetail = txn.liters > 0
        ? `${formatCurrency(txn.liters)} ลิตร @ ${formatCurrency(txn.pricePerLiter)}`
        : '1 รายการ';

    const lines = [
        centerReceiptLine(`[ ${copyType} ]`, columns),
        centerReceiptLine(config.name, columns),
        centerReceiptLine(config.address1, columns),
        centerReceiptLine(config.address2, columns),
        centerReceiptLine(`โทร: ${config.tel}`, columns),
        doubleDivider,
        centerReceiptLine(documentTitle, columns),
        centerReceiptLine(`(${paymentLabel})`, columns),
        divider,
        padReceiptLine('เลขที่', docNo, columns),
        padReceiptLine('วันที่', `${formatReceiptDate(receiptDate)} ${formatReceiptTime(receiptDate)}`, columns),
        padReceiptLine('พนักงาน', txn.recordedBy?.name || '-', columns),
        divider,
        'ข้อมูลลูกค้า',
        padReceiptLine('ชื่อลูกค้า', txn.ownerName || 'เงินสดทั่วไป', columns),
        txn.licensePlate ? padReceiptLine('ทะเบียนรถ', txn.licensePlate, columns) : '',
        divider,
        padReceiptLine('รายการสินค้า', 'รวม (บาท)', columns),
        truncateText(itemLabel, columns),
        padReceiptLine(itemDetail, formatCurrency(txn.amount), columns),
        doubleDivider,
        padReceiptLine('ยอดสุทธิ', `฿ ${formatCurrency(txn.amount)}`, columns),
        doubleDivider,
    ].filter(Boolean);

    if (docType === 'credit') {
        lines.push(
            '',
            padReceiptLine('ผู้รับสินค้า/ลูกค้า', 'ผู้ส่งสินค้า/ผู้ขาย', columns),
            padReceiptLine('________________', '________________', columns),
            centerReceiptLine('วันที่ลงนาม: _____/_____/_____', columns),
        );
    }

    lines.push('', centerReceiptLine('ขอบคุณที่ใช้บริการครับ', columns), centerReceiptLine(`Ref: ${txn.id.slice(0, 8).toUpperCase()}`, columns));

    return `${insetReceiptText(lines.join('\n'), paperSize)}\n`;
}

export interface BuildReceiptPrintInput {
    txn: ReceiptTransaction;
    config: ReceiptConfig;
    docNo: string;
    docType: ReceiptDocType;
    paperSize: PaperSize;
}

export function buildEpsonReceiptPrintXml(input: BuildReceiptPrintInput): string {
    const originalText = buildReceiptCopyText({ ...input, copyType: 'ต้นฉบับ' });
    const copyText = buildReceiptCopyText({ ...input, copyType: 'สำเนา' });

    return [
        '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">',
        '<text lang="mul" />',
        '<text font="font_a" />',
        '<text smooth="true" />',
        '<text linespc="24" />',
        eposText(originalText, ' align="left"'),
        '<feed line="1" />',
        '<cut type="feed" />',
        eposText(copyText, ' align="left"'),
        '<feed line="1" />',
        '<cut type="feed" />',
        '</epos-print>',
    ].join('');
}

export function buildEpsonReceiptPrintUrl(input: BuildReceiptPrintInput): string | null {
    const xml = buildEpsonReceiptPrintXml(input);
    const url = `${EPSON_TM_PRINT_ASSISTANT_URL}?ver=1&data-type=eposprintxml&data=${encodeURIComponent(xml)}`;

    if (url.length > EPSON_TM_PRINT_ASSISTANT_MAX_URL_LENGTH) {
        return null;
    }

    return url;
}

export function printReceiptViaEpsonAssistant(input: BuildReceiptPrintInput): boolean {
    if (!isAndroidDevice()) {
        return false;
    }

    const printUrl = buildEpsonReceiptPrintUrl(input);
    if (!printUrl) {
        return false;
    }

    window.location.href = printUrl;
    return true;
}
