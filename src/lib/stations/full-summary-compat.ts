import { FUEL_TYPES, PAYMENT_TYPES } from '@/constants';

export interface FullSummaryTransaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerId?: string | null;
    ownerName: string;
    paymentType: string;
    fuelType?: string | null;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string | null;
    billNo?: string | null;
    transferProofUrl?: string | null;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function paymentLabel(value: string): string {
    return PAYMENT_TYPES.find((item) => item.value === value)?.label || value;
}

function fuelLabel(value?: string | null): string {
    return FUEL_TYPES.find((item) => item.value === value)?.label || value || '-';
}

function escapeCsvCell(value: string | number | null | undefined): string {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

export function filterFullSummaryTransactions(
    transactions: FullSummaryTransaction[],
    paymentType: string
): FullSummaryTransaction[] {
    return paymentType === 'all'
        ? transactions
        : transactions.filter((transaction) => transaction.paymentType === paymentType);
}

export function buildFullStationSummaryCsv(transactions: FullSummaryTransaction[]): string {
    const headers = ['ลำดับ', 'เล่ม', 'เลขที่', 'ทะเบียน', 'ชื่อลูกค้า', 'ประเภทน้ำมัน', 'ลิตร', 'ราคา/ลิตร', 'ยอดเงิน', 'ชำระ'];
    const rows: Array<Array<string | number>> = transactions.map((transaction, index) => [
        index + 1,
        transaction.billBookNo || '-',
        transaction.billNo || '-',
        transaction.licensePlate || '-',
        transaction.ownerName || '-',
        fuelLabel(transaction.fuelType),
        Number(transaction.liters),
        Number(transaction.pricePerLiter),
        Number(transaction.amount),
        paymentLabel(transaction.paymentType),
    ]);
    const totalLiters = transactions.reduce((sum, transaction) => sum + Number(transaction.liters), 0);
    const totalAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    rows.push([]);
    rows.push(['รวม', '', '', '', '', '', totalLiters, '', totalAmount, '']);

    return `\uFEFF${[headers, ...rows]
        .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
        .join('\n')}`;
}

export function buildFullStationSummaryCsvFilename(stationName: string, selectedDate: string): string {
    const safeStation = stationName.replace(/[\\/:*?"<>|\r\n]+/g, '-').trim() || 'station';
    return `สรุปรายการ_${safeStation}_${selectedDate}.csv`;
}

export function getStationTransactionApiPath(stationParam: string, transactionId: string): string {
    return `/api/station/${encodeURIComponent(stationParam)}/transactions/${encodeURIComponent(transactionId)}`;
}

async function getResponseError(response: Response, fallback: string): Promise<Error> {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    return new Error(payload?.error || fallback);
}

export async function voidFullStationTransaction(input: {
    stationParam: string;
    transactionId: string;
    reason: string;
    fetchImpl?: FetchLike;
}): Promise<void> {
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 200) {
        throw new Error('เหตุผลในการยกเลิกต้องมีความยาว 3-200 ตัวอักษร');
    }

    const fetchImpl = input.fetchImpl || fetch;
    const response = await fetchImpl(getStationTransactionApiPath(input.stationParam, input.transactionId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw await getResponseError(response, 'ลบรายการไม่สำเร็จ');
}

export async function replaceFullStationTransferProof(input: {
    stationParam: string;
    transaction: FullSummaryTransaction;
    file: Blob & { name?: string };
    fetchImpl?: FetchLike;
}): Promise<string> {
    const fetchImpl = input.fetchImpl || fetch;
    const formData = new FormData();
    formData.append('file', input.file, input.file.name || 'transfer-proof');

    const uploadResponse = await fetchImpl('/api/upload/transfer-proof', {
        method: 'POST',
        body: formData,
    });
    if (!uploadResponse.ok) throw await getResponseError(uploadResponse, 'อัปโหลดสลิปไม่สำเร็จ');

    const uploadPayload = await uploadResponse.json().catch(() => null) as { url?: string } | null;
    const transferProofUrl = uploadPayload?.url?.trim();
    if (!transferProofUrl) throw new Error('อัปโหลดสลิปไม่สำเร็จ: ไม่พบ URL');

    const transaction = input.transaction;
    const updateResponse = await fetchImpl(getStationTransactionApiPath(input.stationParam, transaction.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            licensePlate: transaction.licensePlate,
            ownerName: transaction.ownerName,
            ownerId: transaction.ownerId ?? undefined,
            paymentType: transaction.paymentType,
            nozzleNumber: transaction.nozzleNumber,
            liters: Number(transaction.liters),
            pricePerLiter: Number(transaction.pricePerLiter),
            amount: Number(transaction.amount),
            billBookNo: transaction.billBookNo || null,
            billNo: transaction.billNo || null,
            transferProofUrl,
        }),
    });
    if (!updateResponse.ok) throw await getResponseError(updateResponse, 'บันทึกสลิปไม่สำเร็จ');

    return transferProofUrl;
}
