export type FullMeterMaintenanceType = 'start' | 'end';

export interface FullMeterMaintenanceSourceMeter {
    nozzleNumber: number;
    startReading: number | string | null;
    endReading: number | string | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface FullMeterMaintenanceRow {
    nozzleNumber: number;
    startReading: number;
    endReading: number;
    startPhoto: string | null;
    endPhoto: string | null;
}

function finiteNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedUrl(value: string | null | undefined): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeFullMeterMaintenanceRows(
    meters: FullMeterMaintenanceSourceMeter[] = []
): FullMeterMaintenanceRow[] {
    return [1, 2, 3, 4].map((nozzleNumber) => {
        const meter = meters.find((item) => Number(item.nozzleNumber) === nozzleNumber);
        return {
            nozzleNumber,
            startReading: finiteNumber(meter?.startReading),
            endReading: finiteNumber(meter?.endReading),
            startPhoto: normalizedUrl(meter?.startPhoto),
            endPhoto: normalizedUrl(meter?.endPhoto),
        };
    });
}

export function getFullMeterMaintenancePhoto(
    row: FullMeterMaintenanceRow,
    type: FullMeterMaintenanceType
): string | null {
    return type === 'start' ? row.startPhoto : row.endPhoto;
}

export function validateFullMeterMaintenanceRows(
    rows: FullMeterMaintenanceRow[],
    type: FullMeterMaintenanceType
): string[] {
    const errors: string[] = [];
    const nozzles = new Set(rows.map((row) => row.nozzleNumber));
    if (rows.length !== 4 || nozzles.size !== 4 || ![1, 2, 3, 4].every((nozzle) => nozzles.has(nozzle))) {
        errors.push('ต้องมีข้อมูลมิเตอร์หัวจ่าย 1-4 ครบ');
    }

    for (const row of rows) {
        const reading = type === 'start' ? row.startReading : row.endReading;
        if (!Number.isFinite(reading) || reading < 0) {
            errors.push(`หัวจ่าย ${row.nozzleNumber}: เลขมิเตอร์ไม่ถูกต้อง`);
        }
        if (!getFullMeterMaintenancePhoto(row, type)) {
            errors.push(`หัวจ่าย ${row.nozzleNumber}: ต้องมีรูปมิเตอร์${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}`);
        }
        if (type === 'end' && row.startReading > 0 && row.endReading > 0 && row.endReading < row.startReading) {
            errors.push(`หัวจ่าย ${row.nozzleNumber}: มิเตอร์สิ้นสุดน้อยกว่ามิเตอร์เริ่มต้น`);
        }
    }

    return Array.from(new Set(errors));
}

export function buildFullMeterMaintenancePayload(options: {
    date: string;
    shiftId: string | null;
    type: FullMeterMaintenanceType;
    rows: FullMeterMaintenanceRow[];
}) {
    if (!options.shiftId?.trim()) {
        throw new Error('ไม่พบกะที่ผูกกับมิเตอร์ของวันที่เลือก');
    }
    const errors = validateFullMeterMaintenanceRows(options.rows, options.type);
    if (errors.length > 0) throw new Error(errors[0]);

    return {
        date: options.date,
        shiftId: options.shiftId.trim(),
        type: options.type,
        meters: options.rows.map((row) => ({
            nozzleNumber: row.nozzleNumber,
            reading: options.type === 'start' ? row.startReading : row.endReading,
            photo: getFullMeterMaintenancePhoto(row, options.type),
        })),
    };
}
