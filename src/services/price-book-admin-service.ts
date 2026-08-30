import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveStationDefinition } from '@/lib/stations/station-context';

export const PRICE_BOOK_WRITE_OPTIONS = {
    maxWait: 5_000,
    timeout: 20_000,
} as const;

export const PRICE_BOOK_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type PriceBookStatusValue = typeof PRICE_BOOK_STATUSES[number];

export interface PriceBookLineInput {
    productId: string;
    pricePerUnit: number;
}

export interface PriceBookCreateInput {
    stationId: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    lines: PriceBookLineInput[];
    userId: string;
}

export interface PriceBookUpdateInput {
    id: string;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    status?: PriceBookStatusValue;
    lines?: PriceBookLineInput[];
    userId: string;
}

type MutationFailure = { success: false; status: number; error: string };
type MutationSuccess<T> = { success: true; value: T };
export type PriceBookMutationResult<T> = MutationSuccess<T> | MutationFailure;

function failure(status: number, error: string): MutationFailure {
    return { success: false, status, error };
}

export function normalizeConfiguredStationId(value: unknown, activeOnly = false): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const station = resolveStationDefinition(value.trim());
    if (!station) return undefined;
    if (activeOnly && station.operationalStatus !== 'ACTIVE') return undefined;
    return station.id;
}

export function parsePriceBookDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const normalized = value.trim();
    const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
    if (calendar) {
        const year = Number(calendar[1]);
        const month = Number(calendar[2]);
        const day = Number(calendar[3]);
        const probe = new Date(Date.UTC(year, month - 1, day));
        if (
            probe.getUTCFullYear() !== year
            || probe.getUTCMonth() !== month - 1
            || probe.getUTCDate() !== day
        ) return undefined;
    }
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parsePriceBookLines(value: unknown): PriceBookLineInput[] | undefined {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) return undefined;
    const lines: PriceBookLineInput[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
        const row = item as Record<string, unknown>;
        const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
        const pricePerUnit = Number(row.pricePerUnit);
        if (!productId || seen.has(productId) || !Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return undefined;
        seen.add(productId);
        lines.push({ productId, pricePerUnit });
    }
    return lines;
}

export function isPriceBookStatus(value: unknown): value is PriceBookStatusValue {
    return typeof value === 'string' && PRICE_BOOK_STATUSES.includes(value as PriceBookStatusValue);
}

function isLineBasedPriceBook(existing: {
    productType: string | null;
    retailPrice: Prisma.Decimal | null;
    wholesalePrice: Prisma.Decimal | null;
}) {
    return existing.productType === null && existing.retailPrice === null && existing.wholesalePrice === null;
}

async function validateActiveProducts(
    tx: Prisma.TransactionClient,
    lines: PriceBookLineInput[]
): Promise<boolean> {
    const ids = lines.map((line) => line.productId);
    const products = await tx.fuelProduct.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true },
    });
    return products.length === ids.length;
}

export async function createLinePriceBook(input: PriceBookCreateInput): Promise<PriceBookMutationResult<unknown>> {
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
        return failure(400, 'effectiveTo ต้องไม่ก่อน effectiveFrom');
    }

    return prisma.$transaction(async (tx) => {
        if (!await validateActiveProducts(tx, input.lines)) {
            return failure(400, 'พบประเภทเชื้อเพลิงที่ไม่มีหรือปิดใช้งาน');
        }
        const priceBook = await tx.priceBook.create({
            data: {
                stationId: input.stationId,
                effectiveFrom: input.effectiveFrom,
                effectiveTo: input.effectiveTo,
                status: 'DRAFT',
                createdById: input.userId,
                lines: {
                    create: input.lines.map((line) => ({
                        productId: line.productId,
                        pricePerUnit: line.pricePerUnit,
                    })),
                },
            },
            include: {
                lines: { include: { product: { select: { id: true, name: true, code: true } } } },
            },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'CREATE',
                model: 'PriceBook',
                recordId: priceBook.id,
                newData: {
                    source: 'LINE_PRICE_BOOK_API',
                    stationId: input.stationId,
                    effectiveFrom: input.effectiveFrom.toISOString(),
                    effectiveTo: input.effectiveTo?.toISOString() ?? null,
                    status: 'DRAFT',
                    lines: input.lines.map((line) => ({ productId: line.productId, pricePerUnit: line.pricePerUnit })),
                },
            },
        });
        return { success: true, value: priceBook } as const;
    }, PRICE_BOOK_WRITE_OPTIONS);
}

export async function updateLinePriceBook(input: PriceBookUpdateInput): Promise<PriceBookMutationResult<unknown>> {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.priceBook.findUnique({
            where: { id: input.id },
            select: {
                id: true,
                stationId: true,
                productType: true,
                retailPrice: true,
                wholesalePrice: true,
                effectiveFrom: true,
                effectiveTo: true,
                status: true,
                lines: { select: { productId: true, pricePerUnit: true } },
            },
        });
        if (!existing) return failure(404, 'Price book not found');
        if (!isLineBasedPriceBook(existing)) {
            return failure(409, 'Price book นี้เป็น scalar price record และแก้ผ่าน line-based API ไม่ได้');
        }

        const effectiveFrom = input.effectiveFrom ?? existing.effectiveFrom;
        const effectiveTo = input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo;
        if (effectiveTo && effectiveTo < effectiveFrom) {
            return failure(400, 'effectiveTo ต้องไม่ก่อน effectiveFrom');
        }
        if (input.lines && !await validateActiveProducts(tx, input.lines)) {
            return failure(400, 'พบประเภทเชื้อเพลิงที่ไม่มีหรือปิดใช้งาน');
        }

        await tx.priceBook.update({
            where: { id: input.id },
            data: {
                ...(input.effectiveFrom !== undefined && { effectiveFrom: input.effectiveFrom }),
                ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo }),
                ...(input.status !== undefined && { status: input.status }),
            },
        });
        if (input.lines) {
            await tx.priceBookLine.deleteMany({ where: { priceBookId: input.id } });
            await tx.priceBookLine.createMany({
                data: input.lines.map((line) => ({
                    priceBookId: input.id,
                    productId: line.productId,
                    pricePerUnit: line.pricePerUnit,
                })),
            });
        }

        const updated = await tx.priceBook.findUnique({
            where: { id: input.id },
            include: { lines: { include: { product: { select: { id: true, name: true, code: true } } } } },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'UPDATE',
                model: 'PriceBook',
                recordId: input.id,
                oldData: {
                    stationId: existing.stationId,
                    effectiveFrom: existing.effectiveFrom.toISOString(),
                    effectiveTo: existing.effectiveTo?.toISOString() ?? null,
                    status: existing.status,
                    lines: existing.lines.map((line) => ({
                        productId: line.productId,
                        pricePerUnit: Number(line.pricePerUnit),
                    })),
                },
                newData: {
                    source: 'LINE_PRICE_BOOK_API',
                    effectiveFrom: effectiveFrom.toISOString(),
                    effectiveTo: effectiveTo?.toISOString() ?? null,
                    status: input.status ?? existing.status,
                    lines: input.lines
                        ? input.lines.map((line) => ({ productId: line.productId, pricePerUnit: line.pricePerUnit }))
                        : existing.lines.map((line) => ({
                        productId: line.productId,
                        pricePerUnit: Number(line.pricePerUnit),
                    })),
                },
            },
        });
        return { success: true, value: updated } as const;
    }, PRICE_BOOK_WRITE_OPTIONS);
}

export async function deleteLinePriceBook(input: { id: string; userId: string }): Promise<PriceBookMutationResult<{ success: true }>> {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.priceBook.findUnique({
            where: { id: input.id },
            select: {
                id: true,
                stationId: true,
                productType: true,
                retailPrice: true,
                wholesalePrice: true,
                effectiveFrom: true,
                effectiveTo: true,
                status: true,
                lines: { select: { productId: true, pricePerUnit: true } },
            },
        });
        if (!existing) return failure(404, 'Price book not found');
        if (!isLineBasedPriceBook(existing)) {
            return failure(409, 'Price book นี้เป็น scalar price record และลบผ่าน line-based API ไม่ได้');
        }
        if (existing.status !== 'DRAFT') return failure(400, 'Only DRAFT price books can be deleted');

        await tx.priceBookLine.deleteMany({ where: { priceBookId: input.id } });
        await tx.priceBook.delete({ where: { id: input.id } });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'DELETE',
                model: 'PriceBook',
                recordId: input.id,
                oldData: {
                    source: 'LINE_PRICE_BOOK_API',
                    stationId: existing.stationId,
                    effectiveFrom: existing.effectiveFrom.toISOString(),
                    effectiveTo: existing.effectiveTo?.toISOString() ?? null,
                    status: existing.status,
                    lines: existing.lines.map((line) => ({
                        productId: line.productId,
                        pricePerUnit: Number(line.pricePerUnit),
                    })),
                },
            },
        });
        return { success: true, value: { success: true } } as const;
    }, PRICE_BOOK_WRITE_OPTIONS);
}
