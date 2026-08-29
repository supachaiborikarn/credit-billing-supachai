export const FULL_OPENING_METER_COUNT = 4;
export const GAS_OPENING_METER_COUNT = 4;
export const GAS_OPENING_GAUGE_COUNT = 3;
export const MAX_METER_PHOTO_BYTES = 8 * 1024 * 1024;

export interface FullOpeningPrices {
    retailPrice: string;
    wholesalePrice: string;
}

export interface NumericOpeningReading {
    number: number;
    value: string;
}

export interface FullOpeningMeterInput extends NumericOpeningReading {
    file: File | null;
    existingPhoto?: string | null;
}

export interface GasOpeningInput {
    shiftNumber: 1 | 2;
    gasPrice: string;
    meters: NumericOpeningReading[];
    gauges: NumericOpeningReading[];
}

export interface ShiftOpeningValidation {
    valid: boolean;
    errors: string[];
}

export type ShiftOpeningFetch = typeof fetch;

export class ShiftOpeningError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'ShiftOpeningError';
        this.status = status;
    }
}

function parseFiniteNumber(value: string): number | null {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

async function readError(response: Response, fallback: string): Promise<ShiftOpeningError> {
    const payload = await response.json().catch(() => null) as { error?: string; errors?: string[] } | null;
    const message = payload?.errors?.filter(Boolean).join(', ') || payload?.error || fallback;
    return new ShiftOpeningError(message, response.status);
}

export function validateFullOpeningPrices(value: FullOpeningPrices): ShiftOpeningValidation {
    const retailPrice = parseFiniteNumber(value.retailPrice) ?? 0;
    const wholesalePrice = parseFiniteNumber(value.wholesalePrice) ?? 0;
    const errors: string[] = [];

    if (retailPrice <= 0 && wholesalePrice <= 0) {
        errors.push('กรุณากรอกราคาขายประจำวันอย่างน้อย 1 ราคา');
    }
    if (retailPrice < 0 || wholesalePrice < 0) {
        errors.push('ราคาขายต้องไม่ติดลบ');
    }

    return { valid: errors.length === 0, errors };
}

export function parseFullOpeningPrices(value: FullOpeningPrices): { retailPrice: number; wholesalePrice: number } {
    return {
        retailPrice: parseFiniteNumber(value.retailPrice) ?? 0,
        wholesalePrice: parseFiniteNumber(value.wholesalePrice) ?? 0,
    };
}

export function validateFullOpeningMeters(meters: FullOpeningMeterInput[]): ShiftOpeningValidation {
    const errors: string[] = [];
    const expected = new Set([1, 2, 3, 4]);
    const seen = new Set<number>();

    for (const meter of meters) {
        if (!expected.has(meter.number) || seen.has(meter.number)) {
            errors.push('ข้อมูลหัวจ่ายต้องมีหัว 1-4 อย่างละ 1 รายการ');
            break;
        }
        seen.add(meter.number);
        const reading = parseFiniteNumber(meter.value);
        if (reading === null || reading < 0) {
            errors.push(`หัวจ่าย ${meter.number}: กรุณากรอกเลขมิเตอร์ที่ไม่ติดลบ`);
        }
        if (!meter.file && !meter.existingPhoto) {
            errors.push(`หัวจ่าย ${meter.number}: กรุณาแนบรูปมิเตอร์เริ่มต้น`);
        } else if (meter.file && !meter.file.type.startsWith('image/')) {
            errors.push(`หัวจ่าย ${meter.number}: รูปต้องเป็นไฟล์ภาพ`);
        } else if (meter.file && meter.file.size > MAX_METER_PHOTO_BYTES) {
            errors.push(`หัวจ่าย ${meter.number}: รูปต้องไม่เกิน 8 MB`);
        }
    }

    if (meters.length !== FULL_OPENING_METER_COUNT || seen.size !== FULL_OPENING_METER_COUNT) {
        errors.push('ต้องกรอกมิเตอร์เริ่มต้นให้ครบ 4 หัวจ่าย');
    }

    return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export function validateGasOpening(value: GasOpeningInput): ShiftOpeningValidation {
    const errors: string[] = [];
    const gasPrice = parseFiniteNumber(value.gasPrice);
    if (gasPrice === null || gasPrice <= 0) {
        errors.push('ราคาก๊าซต้องมากกว่า 0');
    }
    if (value.shiftNumber !== 1 && value.shiftNumber !== 2) {
        errors.push('เลขกะต้องเป็น 1 หรือ 2');
    }

    const meterNumbers = new Set(value.meters.map((meter) => meter.number));
    if (value.meters.length !== GAS_OPENING_METER_COUNT || meterNumbers.size !== GAS_OPENING_METER_COUNT || ![1, 2, 3, 4].every((number) => meterNumbers.has(number))) {
        errors.push('ต้องกรอกมิเตอร์เริ่มต้นให้ครบ 4 หัวจ่าย');
    }
    for (const meter of value.meters) {
        const reading = parseFiniteNumber(meter.value);
        if (reading === null || reading < 0) {
            errors.push(`หัวจ่าย ${meter.number}: กรุณากรอกเลขมิเตอร์ที่ไม่ติดลบ`);
        }
    }

    const gaugeNumbers = new Set(value.gauges.map((gauge) => gauge.number));
    if (value.gauges.length !== GAS_OPENING_GAUGE_COUNT || gaugeNumbers.size !== GAS_OPENING_GAUGE_COUNT || ![1, 2, 3].every((number) => gaugeNumbers.has(number))) {
        errors.push('ต้องกรอกเกจเริ่มต้นให้ครบ 3 ถัง');
    }
    for (const gauge of value.gauges) {
        const percentage = parseFiniteNumber(gauge.value);
        if (percentage === null || percentage < 0 || percentage > 100) {
            errors.push(`ถัง ${gauge.number}: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100`);
        }
    }

    return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export async function openFullStationShift(options: {
    stationNumber: number;
    businessDate: string;
    prices: FullOpeningPrices;
    fetchImpl?: ShiftOpeningFetch;
}) {
    const validation = validateFullOpeningPrices(options.prices);
    if (!validation.valid) throw new ShiftOpeningError(validation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const prices = parseFullOpeningPrices(options.prices);

    const dailyResponse = await fetchImpl(`/api/station/${options.stationNumber}/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: options.businessDate, ...prices }),
    });
    if (!dailyResponse.ok) throw await readError(dailyResponse, 'บันทึกราคาประจำวันไม่สำเร็จ');

    const shiftResponse = await fetchImpl(`/api/station/${options.stationNumber}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open' }),
    });
    if (!shiftResponse.ok) throw await readError(shiftResponse, 'เปิดกะไม่สำเร็จ');
    return shiftResponse.json();
}

async function uploadFullStartMeterPhoto(options: {
    stationId: string;
    shiftId: string;
    businessDate: string;
    meter: FullOpeningMeterInput;
    fetchImpl: ShiftOpeningFetch;
}): Promise<string> {
    if (!options.meter.file) throw new ShiftOpeningError(`หัวจ่าย ${options.meter.number}: ไม่พบรูปมิเตอร์`);
    const formData = new FormData();
    formData.append('file', options.meter.file);
    formData.append('type', 'start');
    formData.append('nozzle', String(options.meter.number));
    formData.append('date', options.businessDate);
    formData.append('stationId', options.stationId);
    formData.append('shiftId', options.shiftId);

    const response = await options.fetchImpl('/api/upload/meter-photo', { method: 'POST', body: formData });
    if (!response.ok) throw await readError(response, `อัปโหลดรูปหัวจ่าย ${options.meter.number} ไม่สำเร็จ`);
    const payload = await response.json() as { url?: string };
    if (!payload.url) throw new ShiftOpeningError(`อัปโหลดรูปหัวจ่าย ${options.meter.number} แล้วไม่ได้ URL`);
    return payload.url;
}

export async function completeFullOpeningMeters(options: {
    stationId: string;
    stationNumber: number;
    shiftId: string;
    businessDate: string;
    meters: FullOpeningMeterInput[];
    fetchImpl?: ShiftOpeningFetch;
}) {
    const validation = validateFullOpeningMeters(options.meters);
    if (!validation.valid) throw new ShiftOpeningError(validation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const uploaded = [] as Array<{ nozzleNumber: number; reading: number; photo: string }>;

    for (const meter of options.meters) {
        const photo = meter.file
            ? await uploadFullStartMeterPhoto({
                stationId: options.stationId,
                shiftId: options.shiftId,
                businessDate: options.businessDate,
                meter,
                fetchImpl,
            })
            : meter.existingPhoto?.trim();
        if (!photo) throw new ShiftOpeningError(`หัวจ่าย ${meter.number}: ไม่พบรูปมิเตอร์`);
        uploaded.push({
            nozzleNumber: meter.number,
            reading: parseFiniteNumber(meter.value) ?? 0,
            photo,
        });
    }

    const response = await fetchImpl(`/api/station/${options.stationNumber}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: options.businessDate,
            shiftId: options.shiftId,
            type: 'start',
            meters: uploaded,
        }),
    });
    if (!response.ok) throw await readError(response, 'บันทึกมิเตอร์เริ่มต้นไม่สำเร็จ');
    return response.json();
}

export async function openGasStationShift(options: {
    stationNumber: number;
    businessDate: string;
    value: GasOpeningInput;
    fetchImpl?: ShiftOpeningFetch;
}) {
    const validation = validateGasOpening(options.value);
    if (!validation.valid) throw new ShiftOpeningError(validation.errors[0]);
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`/api/v2/gas/${options.stationNumber}/shift/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dateKey: options.businessDate,
            shiftNumber: options.value.shiftNumber,
            gasPrice: parseFiniteNumber(options.value.gasPrice),
            meters: options.value.meters.map((meter) => ({
                nozzleNumber: meter.number,
                reading: parseFiniteNumber(meter.value),
            })),
            gauges: options.value.gauges.map((gauge) => ({
                tankNumber: gauge.number,
                percentage: parseFiniteNumber(gauge.value),
            })),
        }),
    });
    if (!response.ok) throw await readError(response, 'เปิดกะ GAS ไม่สำเร็จ');
    return response.json();
}
