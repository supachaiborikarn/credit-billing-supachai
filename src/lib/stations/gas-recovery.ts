import { MAX_METER_PHOTO_BYTES } from '@/lib/stations/shift-opening';

export type GasRecoveryType = 'start' | 'end';
export type GasRecoveryFetch = typeof fetch;

export interface GasRecoveryMeterInput {
    number: number;
    value: string;
    startReading: number | null;
    existingPhoto: string | null;
    file: File | null;
}

export interface GasRecoveryGaugeInput {
    number: number;
    value: string;
    existingPhoto: string | null;
}

export class GasRecoveryError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'GasRecoveryError';
        this.status = status;
    }
}

function parseNumber(value: string): number | null {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

async function readError(response: Response, fallback: string): Promise<GasRecoveryError> {
    const payload = await response.json().catch(() => null) as { error?: string; errors?: string[] } | null;
    const message = payload?.errors?.filter(Boolean).join(', ') || payload?.error || fallback;
    return new GasRecoveryError(message, response.status);
}

function assertUnlocked(type: GasRecoveryType, locked: boolean, reason?: string | null) {
    if (type === 'start' && locked) {
        throw new GasRecoveryError(reason || 'เลขเปิดถูกล็อกแล้ว กรุณาใช้เครื่องมือแก้ไขของแอดมิน');
    }
}

export function buildGasMeterRecoveryReadings(options: {
    type: GasRecoveryType;
    meters: GasRecoveryMeterInput[];
    startBaselineLocked?: boolean;
    startBaselineLockReason?: string | null;
}) {
    assertUnlocked(options.type, Boolean(options.startBaselineLocked), options.startBaselineLockReason);
    const expected = [1, 2, 3, 4];
    const numbers = options.meters.map((meter) => meter.number).sort((a, b) => a - b);
    if (options.meters.length !== 4 || numbers.some((number, index) => number !== expected[index])) {
        throw new GasRecoveryError('ต้องกรอกมิเตอร์ให้ครบ 4 หัวจ่าย');
    }

    return options.meters.map((meter) => {
        const reading = parseNumber(meter.value);
        if (reading === null || reading < 0) {
            throw new GasRecoveryError(`หัวจ่าย ${meter.number}: กรุณากรอกเลขมิเตอร์ที่ไม่ติดลบ`);
        }
        if (options.type === 'end') {
            if (meter.startReading === null) {
                throw new GasRecoveryError(`หัวจ่าย ${meter.number}: ยังไม่มีเลขมิเตอร์เริ่มกะ`);
            }
            if (reading < meter.startReading) {
                throw new GasRecoveryError(`หัวจ่าย ${meter.number}: เลขปิดต้องไม่น้อยกว่าเลขเปิด ${meter.startReading.toLocaleString('th-TH')}`);
            }
        }
        if (meter.file && !meter.file.type.startsWith('image/')) {
            throw new GasRecoveryError(`หัวจ่าย ${meter.number}: รูปต้องเป็นไฟล์ภาพ`);
        }
        if (meter.file && meter.file.size > MAX_METER_PHOTO_BYTES) {
            throw new GasRecoveryError(`หัวจ่าย ${meter.number}: รูปต้องไม่เกิน 8 MB`);
        }
        return {
            nozzleNumber: meter.number,
            reading,
            photoUrl: meter.existingPhoto?.trim() || null,
        };
    });
}

export function buildGasGaugeRecoveryReadings(options: {
    type: GasRecoveryType;
    gauges: GasRecoveryGaugeInput[];
    startBaselineLocked?: boolean;
    startBaselineLockReason?: string | null;
}) {
    assertUnlocked(options.type, Boolean(options.startBaselineLocked), options.startBaselineLockReason);
    const expected = [1, 2, 3];
    const numbers = options.gauges.map((gauge) => gauge.number).sort((a, b) => a - b);
    if (options.gauges.length !== 3 || numbers.some((number, index) => number !== expected[index])) {
        throw new GasRecoveryError('ต้องกรอกเกจให้ครบ 3 ถัง');
    }

    return options.gauges.map((gauge) => {
        const percentage = parseNumber(gauge.value);
        if (percentage === null || percentage < 0 || percentage > 100) {
            throw new GasRecoveryError(`ถัง ${gauge.number}: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100`);
        }
        return {
            tankNumber: gauge.number,
            percentage,
            photoUrl: gauge.existingPhoto?.trim() || null,
        };
    });
}

async function uploadMeterPhoto(options: {
    stationId: string;
    shiftId: string;
    businessDate: string;
    type: GasRecoveryType;
    meter: GasRecoveryMeterInput;
    fetchImpl: GasRecoveryFetch;
}) {
    if (!options.meter.file) return options.meter.existingPhoto?.trim() || null;
    const formData = new FormData();
    formData.append('file', options.meter.file);
    formData.append('type', options.type);
    formData.append('nozzle', String(options.meter.number));
    formData.append('date', options.businessDate);
    formData.append('stationId', options.stationId);
    formData.append('shiftId', options.shiftId);
    const response = await options.fetchImpl('/api/upload/meter-photo', { method: 'POST', body: formData });
    if (!response.ok) throw await readError(response, `อัปโหลดรูปหัวจ่าย ${options.meter.number} ไม่สำเร็จ`);
    const payload = await response.json() as { url?: string };
    if (!payload.url) throw new GasRecoveryError(`อัปโหลดรูปหัวจ่าย ${options.meter.number} แล้วไม่ได้ URL`);
    return payload.url;
}

export async function saveGasMeterRecovery(options: {
    stationId: string;
    stationNumber: number;
    shiftId: string;
    businessDate: string;
    type: GasRecoveryType;
    meters: GasRecoveryMeterInput[];
    startBaselineLocked?: boolean;
    startBaselineLockReason?: string | null;
    fetchImpl?: GasRecoveryFetch;
}) {
    const initial = buildGasMeterRecoveryReadings(options);
    const fetchImpl = options.fetchImpl ?? fetch;
    const readings = [] as typeof initial;
    for (let index = 0; index < options.meters.length; index += 1) {
        const meter = options.meters[index];
        const photoUrl = await uploadMeterPhoto({
            stationId: options.stationId,
            shiftId: options.shiftId,
            businessDate: options.businessDate,
            type: options.type,
            meter,
            fetchImpl,
        });
        readings.push({ ...initial[index], photoUrl });
    }

    const response = await fetchImpl(`/api/v2/gas/${options.stationNumber}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: options.shiftId, type: options.type, readings }),
    });
    if (!response.ok) throw await readError(response, 'บันทึกมิเตอร์ไม่สำเร็จ');
    return response.json();
}

export async function saveGasGaugeRecovery(options: {
    stationNumber: number;
    shiftId: string;
    type: GasRecoveryType;
    gauges: GasRecoveryGaugeInput[];
    startBaselineLocked?: boolean;
    startBaselineLockReason?: string | null;
    fetchImpl?: GasRecoveryFetch;
}) {
    const readings = buildGasGaugeRecoveryReadings(options);
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(`/api/v2/gas/${options.stationNumber}/gauge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: options.shiftId, type: options.type, readings }),
    });
    if (!response.ok) throw await readError(response, 'บันทึกเกจไม่สำเร็จ');
    return response.json();
}
