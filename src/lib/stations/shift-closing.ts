export const FULL_CLOSING_METER_COUNT = 4;
export const GAS_CLOSING_METER_COUNT = 4;
export const GAS_CLOSING_GAUGE_COUNT = 3;
export const MAX_CLOSING_PHOTO_BYTES = 8 * 1024 * 1024;

export interface ClosingMeterInput {
    number: number;
    startReading: number;
    value: string;
    price?: number;
    file?: File | null;
    existingPhoto?: string | null;
}

export interface ClosingGaugeInput {
    number: number;
    value: string;
}

export interface ClosingProductInput {
    productId: string;
    name: string;
    salePrice: number;
    openingQty: number;
    received: string;
    closingQty: string;
}

export interface FullClosingCashInput {
    cashReceived: string;
    creditExpected: number;
    cardReceived: string;
    transferReceived: string;
    expenses: string;
    expenseNote: string;
    discounts: string;
    discountNote: string;
}

export interface GasClosingMoneyInput {
    cashReceived: string;
    creditReceived: string;
    cardReceived: string;
    transferReceived: string;
    productTransferAmount: string;
    otherIncomeAmount: string;
    otherIncomeNote: string;
    otherExpensesAmount: string;
    otherExpenseNote: string;
    varianceNote: string;
}

export interface ClosingPreview {
    totalLiters: number;
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    totalExpected: number;
    totalReceived: number;
    variance: number;
    varianceStatus: 'GREEN' | 'YELLOW' | 'RED';
}

export interface ClosingValidation {
    valid: boolean;
    errors: string[];
}

export interface ClosingAnomaly {
    nozzleNumber: number;
    soldQty: number;
    averageQty: number;
    percentDiff: number;
    severity: 'WARNING' | 'CRITICAL';
    message: string;
}

export interface ClosingAnomalyPreview {
    hasAnomalies: boolean;
    anomalies: ClosingAnomaly[];
    requiresNote: boolean;
}

export type ShiftClosingFetch = typeof fetch;

export class ShiftClosingError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'ShiftClosingError';
        this.status = status;
    }
}

export function parseClosingNumber(value: string): number | null {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function amount(value: string): number {
    const parsed = parseClosingNumber(value);
    return parsed !== null && parsed >= 0 ? parsed : 0;
}

function varianceStatus(absVariance: number, thresholds: { yellow: number; red: number }): 'GREEN' | 'YELLOW' | 'RED' {
    if (absVariance > thresholds.red) return 'RED';
    if (absVariance > thresholds.yellow) return 'YELLOW';
    return 'GREEN';
}

async function readClosingError(response: Response, fallback: string): Promise<ShiftClosingError> {
    const payload = await response.json().catch(() => null) as { error?: string; errors?: string[] } | null;
    return new ShiftClosingError(payload?.errors?.filter(Boolean).join(', ') || payload?.error || fallback, response.status);
}

function validateMeterSequence(meters: ClosingMeterInput[], requirePhotos: boolean): string[] {
    const errors: string[] = [];
    const seen = new Set<number>();

    for (const meter of meters) {
        if (![1, 2, 3, 4].includes(meter.number) || seen.has(meter.number)) {
            errors.push('ข้อมูลหัวจ่ายต้องมีหัว 1-4 อย่างละ 1 รายการ');
            break;
        }
        seen.add(meter.number);
        const reading = parseClosingNumber(meter.value);
        if (reading === null || reading < meter.startReading) {
            errors.push(`หัวจ่าย ${meter.number}: เลขมิเตอร์ปิดต้องไม่น้อยกว่า ${meter.startReading}`);
        }
        if (requirePhotos) {
            if (!meter.file && !meter.existingPhoto) {
                errors.push(`หัวจ่าย ${meter.number}: กรุณาแนบรูปมิเตอร์สิ้นสุด`);
            } else if (meter.file && !meter.file.type.startsWith('image/')) {
                errors.push(`หัวจ่าย ${meter.number}: รูปต้องเป็นไฟล์ภาพ`);
            } else if (meter.file && meter.file.size > MAX_CLOSING_PHOTO_BYTES) {
                errors.push(`หัวจ่าย ${meter.number}: รูปต้องไม่เกิน 8 MB`);
            }
        }
    }

    if (meters.length !== 4 || seen.size !== 4) errors.push('ต้องกรอกมิเตอร์ปิดให้ครบ 4 หัวจ่าย');
    return Array.from(new Set(errors));
}

export function validateFullClosingMeters(meters: ClosingMeterInput[]): ClosingValidation {
    const errors = validateMeterSequence(meters, true);
    return { valid: errors.length === 0, errors };
}

export function validateGasClosingReadings(meters: ClosingMeterInput[], gauges: ClosingGaugeInput[]): ClosingValidation {
    const errors = validateMeterSequence(meters, false);
    const seenGauges = new Set<number>();
    for (const gauge of gauges) {
        if (![1, 2, 3].includes(gauge.number) || seenGauges.has(gauge.number)) {
            errors.push('ข้อมูลเกจต้องมีถัง 1-3 อย่างละ 1 รายการ');
            break;
        }
        seenGauges.add(gauge.number);
        const reading = parseClosingNumber(gauge.value);
        if (reading === null || reading < 0 || reading > 100) {
            errors.push(`ถัง ${gauge.number}: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100`);
        }
    }
    if (gauges.length !== 3 || seenGauges.size !== 3) errors.push('ต้องกรอกเกจปิดให้ครบ 3 ถัง');
    return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export function validateClosingProducts(products: ClosingProductInput[]): ClosingValidation {
    const errors: string[] = [];
    for (const product of products) {
        const received = parseClosingNumber(product.received) ?? 0;
        const closingQty = parseClosingNumber(product.closingQty);
        if (!Number.isInteger(received) || received < 0 || closingQty === null || !Number.isInteger(closingQty) || closingQty < 0) {
            errors.push(`${product.name}: จำนวนรับเข้า/คงเหลือต้องเป็นจำนวนเต็มไม่ติดลบ`);
            continue;
        }
        if (product.openingQty + received - closingQty < 0) {
            errors.push(`${product.name}: คงเหลือมากกว่ายกมา + รับเข้า`);
        }
    }
    return { valid: errors.length === 0, errors };
}

export function calculateFullClosingPreview(meters: ClosingMeterInput[], cash: FullClosingCashInput): ClosingPreview {
    const totalLiters = meters.reduce((sum, meter) => {
        const end = parseClosingNumber(meter.value) ?? meter.startReading;
        return sum + Math.max(end - meter.startReading, 0);
    }, 0);
    const expectedFuelAmount = meters.reduce((sum, meter) => {
        const end = parseClosingNumber(meter.value) ?? meter.startReading;
        return sum + Math.max(end - meter.startReading, 0) * (meter.price || 0);
    }, 0);
    const expectedOtherAmount = 0;
    const totalExpected = expectedFuelAmount;
    const totalReceived = amount(cash.cashReceived)
        + Math.max(cash.creditExpected, 0)
        + amount(cash.cardReceived)
        + amount(cash.transferReceived)
        - amount(cash.expenses)
        - amount(cash.discounts);
    const variance = totalExpected - totalReceived;
    return {
        totalLiters, expectedFuelAmount, expectedOtherAmount, totalExpected, totalReceived, variance,
        varianceStatus: varianceStatus(Math.abs(variance), { yellow: 200, red: 500 }),
    };
}

export function calculateGasClosingPreview(options: {
    meters: ClosingMeterInput[];
    gasPrice: number;
    products: ClosingProductInput[];
    money: GasClosingMoneyInput;
}): ClosingPreview & { productSalesAmount: number } {
    const totalLiters = options.meters.reduce((sum, meter) => {
        const end = parseClosingNumber(meter.value) ?? meter.startReading;
        return sum + Math.max(end - meter.startReading, 0);
    }, 0);
    const expectedFuelAmount = totalLiters * Math.max(options.gasPrice, 0);
    const productSalesAmount = options.products.reduce((sum, product) => {
        const received = parseClosingNumber(product.received) ?? 0;
        const closingQty = parseClosingNumber(product.closingQty) ?? product.openingQty;
        const sold = Math.max(product.openingQty + received - closingQty, 0);
        return sum + sold * product.salePrice;
    }, 0);
    const expectedOtherAmount = productSalesAmount + amount(options.money.otherIncomeAmount) - amount(options.money.otherExpensesAmount);
    const totalExpected = expectedFuelAmount + expectedOtherAmount;
    const totalReceived = amount(options.money.cashReceived) + amount(options.money.creditReceived) + amount(options.money.cardReceived) + amount(options.money.transferReceived);
    const variance = totalReceived - totalExpected;
    return {
        totalLiters, expectedFuelAmount, expectedOtherAmount, totalExpected, totalReceived, variance, productSalesAmount,
        varianceStatus: varianceStatus(Math.abs(variance), { yellow: 100, red: 500 }),
    };
}

async function uploadFullEndPhoto(options: {
    stationId: string; stationNumber: number; shiftId: string; businessDate: string; meter: ClosingMeterInput; fetchImpl: ShiftClosingFetch;
}): Promise<string> {
    if (!options.meter.file) throw new ShiftClosingError(`หัวจ่าย ${options.meter.number}: ไม่พบรูปมิเตอร์ปิด`);
    const formData = new FormData();
    formData.append('file', options.meter.file);
    formData.append('type', 'end');
    formData.append('nozzle', String(options.meter.number));
    formData.append('date', options.businessDate);
    formData.append('stationId', options.stationId);
    formData.append('shiftId', options.shiftId);
    const response = await options.fetchImpl('/api/upload/meter-photo', { method: 'POST', body: formData });
    if (!response.ok) throw await readClosingError(response, `อัปโหลดรูปหัวจ่าย ${options.meter.number} ไม่สำเร็จ`);
    const payload = await response.json() as { url?: string };
    if (!payload.url) throw new ShiftClosingError(`อัปโหลดรูปหัวจ่าย ${options.meter.number} แล้วไม่ได้ URL`);
    return payload.url;
}

export async function saveFullClosingMeters(options: {
    stationId: string; stationNumber: number; shiftId: string; businessDate: string; meters: ClosingMeterInput[]; fetchImpl?: ShiftClosingFetch;
}) {
    const validation = validateFullClosingMeters(options.meters);
    if (!validation.valid) throw new ShiftClosingError(validation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const uploaded: Array<{ nozzleNumber: number; reading: number; photo: string }> = [];
    for (const meter of options.meters) {
        const photo = meter.file
            ? await uploadFullEndPhoto({ ...options, meter, fetchImpl })
            : meter.existingPhoto!;
        uploaded.push({ nozzleNumber: meter.number, reading: parseClosingNumber(meter.value) ?? 0, photo });
    }
    const response = await fetchImpl(`/api/station/${options.stationNumber}/meters`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: options.businessDate, shiftId: options.shiftId, type: 'end', meters: uploaded }),
    });
    if (!response.ok) throw await readClosingError(response, 'บันทึกมิเตอร์ปิดกะไม่สำเร็จ');
    return response.json();
}

export async function saveGasClosingReadings(options: {
    stationNumber: number; shiftId: string; meters: ClosingMeterInput[]; gauges: ClosingGaugeInput[]; fetchImpl?: ShiftClosingFetch;
}) {
    const validation = validateGasClosingReadings(options.meters, options.gauges);
    if (!validation.valid) throw new ShiftClosingError(validation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const meterResponse = await fetchImpl(`/api/v2/gas/${options.stationNumber}/meters`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: options.shiftId, type: 'end', readings: options.meters.map((meter) => ({ nozzleNumber: meter.number, reading: parseClosingNumber(meter.value) })) }),
    });
    if (!meterResponse.ok) throw await readClosingError(meterResponse, 'บันทึกมิเตอร์ปิดกะ GAS ไม่สำเร็จ');
    const gaugeResponse = await fetchImpl(`/api/v2/gas/${options.stationNumber}/gauge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: options.shiftId, type: 'end', readings: options.gauges.map((gauge) => ({ tankNumber: gauge.number, percentage: parseClosingNumber(gauge.value) })) }),
    });
    if (!gaugeResponse.ok) throw await readClosingError(gaugeResponse, 'บันทึกเกจปิดกะ GAS ไม่สำเร็จ');
    return gaugeResponse.json();
}

export async function previewClosingAnomalies(options: {
    stationNumber: number; shiftId: string; meters: ClosingMeterInput[]; fetchImpl?: ShiftClosingFetch;
}): Promise<ClosingAnomalyPreview> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`/api/gas-station/${options.stationNumber}/shifts/${options.shiftId}/anomalies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meters: options.meters.map((meter) => ({ nozzleNumber: meter.number, soldQty: Math.max((parseClosingNumber(meter.value) ?? meter.startReading) - meter.startReading, 0) })) }),
    });
    if (!response.ok) throw await readClosingError(response, 'ตรวจความผิดปกติของมิเตอร์ไม่สำเร็จ');
    return response.json();
}

export async function closeFullStationShift(options: {
    stationNumber: number; shiftId: string; meters: ClosingMeterInput[]; cash: FullClosingCashInput; anomalyNote: string; fetchImpl?: ShiftClosingFetch;
}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`/api/station/${options.stationNumber}/shift-end`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shiftId: options.shiftId,
            meters: options.meters.map((meter) => ({ nozzleNumber: meter.number, startReading: meter.startReading, endReading: parseClosingNumber(meter.value), price: meter.price || 0 })),
            products: [],
            cash: {
                cashReceived: amount(options.cash.cashReceived),
                cardReceived: amount(options.cash.cardReceived),
                transferReceived: amount(options.cash.transferReceived),
                expenses: amount(options.cash.expenses), expenseNote: options.cash.expenseNote,
                discounts: amount(options.cash.discounts), discountNote: options.cash.discountNote,
            },
            anomalyNote: options.anomalyNote.trim() || undefined,
        }),
    });
    if (!response.ok) throw await readClosingError(response, 'ปิดกะ FULL ไม่สำเร็จ');
    return response.json();
}

export async function closeGasStationShift(options: {
    stationNumber: number; shiftId: string; products: ClosingProductInput[]; money: GasClosingMoneyInput; fetchImpl?: ShiftClosingFetch;
}) {
    const productValidation = validateClosingProducts(options.products);
    if (!productValidation.valid) throw new ShiftClosingError(productValidation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`/api/v2/gas/${options.stationNumber}/shift/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shiftId: options.shiftId,
            reconciliation: {
                cashReceived: amount(options.money.cashReceived), creditReceived: amount(options.money.creditReceived),
                cardReceived: amount(options.money.cardReceived), transferReceived: amount(options.money.transferReceived),
                products: options.products.map((product) => ({
                    productId: product.productId, received: parseClosingNumber(product.received) ?? 0, closingQty: parseClosingNumber(product.closingQty) ?? product.openingQty,
                })),
                productTransferAmount: amount(options.money.productTransferAmount),
                otherIncomeAmount: amount(options.money.otherIncomeAmount), otherIncomeNote: options.money.otherIncomeNote,
                otherExpensesAmount: amount(options.money.otherExpensesAmount), otherExpenseNote: options.money.otherExpenseNote,
                varianceNote: options.money.varianceNote,
            },
        }),
    });
    if (!response.ok) throw await readClosingError(response, 'ปิดกะ GAS ไม่สำเร็จ');
    return response.json();
}
