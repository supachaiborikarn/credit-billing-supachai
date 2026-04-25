import type { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_GAS_PRICE } from '@/constants';

export const GAS_NOZZLE_NUMBERS = [1, 2, 3, 4] as const;
export const GAS_TANK_NUMBERS = [1, 2, 3] as const;

type GasPriceClient =
    | Pick<PrismaClient, 'station' | 'gasSettings'>
    | Pick<Prisma.TransactionClient, 'station' | 'gasSettings'>;

export interface GasMeterPayload {
    nozzleNumber: number;
    reading: number;
    photoUrl?: string | null;
}

export interface GasGaugePayload {
    tankNumber: number;
    percentage: number;
    photoUrl?: string | null;
}

export interface ValidationResult<T> {
    ok: boolean;
    errors: string[];
    value: T[];
}

export interface GasStartBaselineState {
    shiftStatus: string;
    transactionCount: number;
    hasEndMeters: boolean;
    hasEndGauges: boolean;
    hasReconciliation: boolean;
}

export interface GasStartBaselineLock {
    locked: boolean;
    reason: string | null;
}

function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveNumber(value: unknown): number | null {
    const parsed = toFiniteNumber(value);
    return parsed !== null && parsed > 0 ? parsed : null;
}

function toNonNegativeNumber(value: unknown): number | null {
    const parsed = toFiniteNumber(value);
    return parsed !== null && parsed >= 0 ? parsed : null;
}

function validateExactSequence<T extends GasMeterPayload | GasGaugePayload>(
    entries: unknown,
    expectedNumbers: readonly number[],
    kind: 'meter' | 'gauge'
): ValidationResult<T> {
    const errors: string[] = [];

    if (!Array.isArray(entries)) {
        return {
            ok: false,
            errors: ['Payload ต้องเป็น array'],
            value: [],
        };
    }

    if (entries.length !== expectedNumbers.length) {
        errors.push(
            kind === 'meter'
                ? `ต้องส่งมิเตอร์ให้ครบ ${expectedNumbers.length} หัวจ่าย`
                : `ต้องส่งเกจให้ครบ ${expectedNumbers.length} ถัง`
        );
    }

    const seen = new Set<number>();
    const normalized: T[] = [];

    for (const entry of entries) {
        if (kind === 'meter') {
            const item = entry as Partial<GasMeterPayload>;
            const nozzleNumber = toFiniteNumber(item.nozzleNumber);
            const reading = toNonNegativeNumber(item.reading);

            if (
                nozzleNumber === null
                || !Number.isInteger(nozzleNumber)
                || !expectedNumbers.includes(nozzleNumber)
            ) {
                errors.push(`หัวจ่ายต้องเป็น ${expectedNumbers.join(', ')}`);
                continue;
            }

            if (seen.has(nozzleNumber)) {
                errors.push(`หัวจ่าย ${nozzleNumber} ถูกส่งซ้ำ`);
                continue;
            }

            if (reading === null) {
                errors.push(`หัวจ่าย ${nozzleNumber}: ตัวเลขต้องเป็นจำนวนไม่ติดลบ`);
                continue;
            }

            seen.add(nozzleNumber);
            normalized.push({
                nozzleNumber,
                reading,
                photoUrl: item.photoUrl || null,
            } as T);
            continue;
        }

        const item = entry as Partial<GasGaugePayload>;
        const tankNumber = toFiniteNumber(item.tankNumber);
        const percentage = toNonNegativeNumber(item.percentage);

        if (
            tankNumber === null
            || !Number.isInteger(tankNumber)
            || !expectedNumbers.includes(tankNumber)
        ) {
            errors.push(`ถังต้องเป็น ${expectedNumbers.join(', ')}`);
            continue;
        }

        if (seen.has(tankNumber)) {
            errors.push(`ถัง ${tankNumber} ถูกส่งซ้ำ`);
            continue;
        }

        if (percentage === null || percentage > 100) {
            errors.push(`ถัง ${tankNumber}: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100`);
            continue;
        }

        seen.add(tankNumber);
        normalized.push({
            tankNumber,
            percentage,
            photoUrl: item.photoUrl || null,
        } as T);
    }

    for (const expectedNumber of expectedNumbers) {
        if (!seen.has(expectedNumber)) {
            errors.push(
                kind === 'meter'
                    ? `หัวจ่าย ${expectedNumber}: ไม่มีข้อมูล`
                    : `ถัง ${expectedNumber}: ไม่มีข้อมูล`
            );
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        value: normalized.sort((a, b) => {
            const left = kind === 'meter'
                ? (a as GasMeterPayload).nozzleNumber
                : (a as GasGaugePayload).tankNumber;
            const right = kind === 'meter'
                ? (b as GasMeterPayload).nozzleNumber
                : (b as GasGaugePayload).tankNumber;
            return left - right;
        }),
    };
}

export function validateGasMeterPayload(entries: unknown): ValidationResult<GasMeterPayload> {
    return validateExactSequence<GasMeterPayload>(entries, GAS_NOZZLE_NUMBERS, 'meter');
}

export function validateGasGaugePayload(entries: unknown): ValidationResult<GasGaugePayload> {
    return validateExactSequence<GasGaugePayload>(entries, GAS_TANK_NUMBERS, 'gauge');
}

export function normalizeGasSaleLiters(value: unknown): number | null {
    return toPositiveNumber(value);
}

export function normalizeGasSaleAmount(value: unknown): number | null {
    const parsed = toPositiveNumber(value);
    return parsed === null ? null : roundGasCurrency(parsed);
}

export function roundGasCurrency(value: number): number {
    return Number(value.toFixed(2));
}

export function roundGasQuantity(value: number): number {
    return Number(value.toFixed(5));
}

export async function getDefaultGasPriceForStation(
    client: GasPriceClient,
    stationId: string
): Promise<number> {
    const [station, setting] = await Promise.all([
        client.station.findUnique({
            where: { id: stationId },
            select: { gasPrice: true },
        }),
        client.gasSettings.findUnique({
            where: { key: 'gasPrice' },
            select: { value: true },
        }),
    ]);

    return toPositiveNumber(station?.gasPrice)
        ?? toPositiveNumber(setting?.value)
        ?? DEFAULT_GAS_PRICE;
}

export async function resolveDailyGasPrice(
    client: GasPriceClient,
    stationId: string,
    dailyRecordGasPrice: unknown
): Promise<number> {
    return toPositiveNumber(dailyRecordGasPrice)
        ?? getDefaultGasPriceForStation(client, stationId);
}

export function getGasStartBaselineLock(state: GasStartBaselineState): GasStartBaselineLock {
    if (state.shiftStatus !== 'OPEN') {
        return {
            locked: true,
            reason: 'แก้ค่าเริ่มกะได้เฉพาะกะที่เปิดอยู่',
        };
    }

    if (state.hasReconciliation) {
        return {
            locked: true,
            reason: 'กะนี้เริ่มเข้าสรุปปิดกะแล้ว',
        };
    }

    if (state.hasEndMeters || state.hasEndGauges) {
        return {
            locked: true,
            reason: 'มีข้อมูลปิดกะแล้ว',
        };
    }

    if (state.transactionCount > 0) {
        return {
            locked: true,
            reason: 'กะนี้เริ่มมีรายการขายแล้ว',
        };
    }

    return {
        locked: false,
        reason: null,
    };
}
