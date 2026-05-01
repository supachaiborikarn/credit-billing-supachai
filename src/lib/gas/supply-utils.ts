import {
    getEndOfDayBangkokUTC,
    getStartOfDayBangkokUTC,
    isValidDateKey,
    toBangkokDateKey,
} from './date-utils';

type NumericLike = number | string | null | undefined | { toString(): string };

export interface NormalizedGasSupplyInput {
    dateKey: string;
    date: Date;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    notes: string | null;
}

export interface GasSupplySummary {
    totalLiters: number;
    totalCost: number;
    count: number;
    averageCostPerLiter: number | null;
}

export interface SerializedGasSupply {
    id: string;
    stationId: string;
    stationName?: string | null;
    date: string;
    displayDate: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    notes: string | null;
    createdAt: string;
}

function normalizeThaiDigits(value: string): string {
    const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
    return value.replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)));
}

function parseNumber(value: NumericLike): number | null {
    if (value === null || value === undefined) return null;
    const normalized = normalizeThaiDigits(String(value)).replace(/,/g, '').trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function roundGasSupplyNumber(value: number): number {
    return Number(value.toFixed(2));
}

export function normalizeGasSupplyInput(body: Record<string, unknown>): {
    ok: boolean;
    errors: string[];
    value?: NormalizedGasSupplyInput;
} {
    const errors: string[] = [];
    const dateKey = optionalText(body.dateKey) ?? optionalText(body.date);

    if (!dateKey || !isValidDateKey(dateKey)) {
        errors.push('กรุณาระบุวันที่รับแก๊สให้ถูกต้อง');
    }

    const liters = parseNumber(body.liters as NumericLike);
    if (liters === null || liters <= 0) {
        errors.push('กรุณาระบุจำนวนลิตรรับเข้าให้มากกว่า 0');
    }

    const pricePerLiter = parseNumber(body.pricePerLiter as NumericLike);
    if (pricePerLiter !== null && pricePerLiter < 0) {
        errors.push('ราคาทุนต่อลิตรต้องไม่ติดลบ');
    }

    const submittedTotalCost = parseNumber(body.totalCost as NumericLike);
    if (submittedTotalCost !== null && submittedTotalCost < 0) {
        errors.push('ยอดรวมต้นทุนต้องไม่ติดลบ');
    }

    if (errors.length > 0 || !dateKey || liters === null) {
        return { ok: false, errors };
    }

    const totalCost = submittedTotalCost !== null
        ? roundGasSupplyNumber(submittedTotalCost)
        : (pricePerLiter !== null ? roundGasSupplyNumber(liters * pricePerLiter) : null);
    const normalizedPrice = pricePerLiter !== null
        ? roundGasSupplyNumber(pricePerLiter)
        : (totalCost !== null ? roundGasSupplyNumber(totalCost / liters) : null);

    return {
        ok: true,
        errors: [],
        value: {
            dateKey,
            date: getStartOfDayBangkokUTC(dateKey),
            liters: roundGasSupplyNumber(liters),
            supplier: optionalText(body.supplier),
            invoiceNo: optionalText(body.invoiceNo),
            pricePerLiter: normalizedPrice,
            totalCost,
            notes: optionalText(body.notes),
        },
    };
}

export function getGasSupplyDateFilter(from: string | null, to: string | null) {
    const todayKey = toBangkokDateKey(new Date());
    const fromKey = from && isValidDateKey(from) ? from : todayKey;
    const toKey = to && isValidDateKey(to) ? to : todayKey;

    return {
        fromKey,
        toKey,
        range: {
            gte: getStartOfDayBangkokUTC(fromKey),
            lte: getEndOfDayBangkokUTC(toKey),
        },
    };
}

export function serializeGasSupply(
    supply: {
        id: string;
        stationId: string;
        date: Date;
        liters: NumericLike;
        supplier: string | null;
        invoiceNo: string | null;
        pricePerLiter: NumericLike;
        totalCost: NumericLike;
        notes: string | null;
        createdAt: Date;
        station?: { name: string | null } | null;
    },
    stationName?: string | null
): SerializedGasSupply {
    const dateKey = toBangkokDateKey(supply.date);
    return {
        id: supply.id,
        stationId: supply.stationId,
        stationName: stationName ?? supply.station?.name ?? null,
        date: dateKey,
        displayDate: supply.date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'Asia/Bangkok',
        }),
        liters: roundGasSupplyNumber(parseNumber(supply.liters) ?? 0),
        supplier: supply.supplier,
        invoiceNo: supply.invoiceNo,
        pricePerLiter: parseNumber(supply.pricePerLiter),
        totalCost: parseNumber(supply.totalCost),
        notes: supply.notes,
        createdAt: supply.createdAt.toISOString(),
    };
}

export function summarizeGasSupplies(supplies: Array<{ liters: number; totalCost: number | null }>): GasSupplySummary {
    const totalLiters = roundGasSupplyNumber(
        supplies.reduce((sum, supply) => sum + supply.liters, 0)
    );
    const totalCost = roundGasSupplyNumber(
        supplies.reduce((sum, supply) => sum + (supply.totalCost ?? 0), 0)
    );

    return {
        totalLiters,
        totalCost,
        count: supplies.length,
        averageCostPerLiter: totalLiters > 0 && totalCost > 0
            ? roundGasSupplyNumber(totalCost / totalLiters)
            : null,
    };
}
