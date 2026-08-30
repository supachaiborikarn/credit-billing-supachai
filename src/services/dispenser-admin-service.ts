import { prisma } from '@/lib/prisma';
import { resolveStationDefinition } from '@/lib/stations/station-context';

const DISPENSER_WRITE_OPTIONS = {
    maxWait: 5_000,
    timeout: 20_000,
} as const;

type MutationCode = 'INVALID_STATION' | 'NOT_FOUND' | 'INVALID_PRODUCT';

type MutationResult<T> =
    | { success: true; value: T }
    | { success: false; code: MutationCode; error: string };

export interface DispenserNozzleInput {
    code: string;
    productId: string;
}

function resolveActiveStation(stationInput: string) {
    const station = resolveStationDefinition(stationInput);
    return station?.operationalStatus === 'ACTIVE' ? station : null;
}

function failure(code: MutationCode, error: string): MutationResult<never> {
    return { success: false, code, error };
}

export async function createDispenserAdmin(input: {
    stationId: string;
    code: string;
    nozzles: DispenserNozzleInput[];
    userId: string;
}): Promise<MutationResult<unknown>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        if (input.nozzles.length > 0) {
            const productIds = [...new Set(input.nozzles.map((nozzle) => nozzle.productId))];
            const products = await tx.fuelProduct.findMany({
                where: { id: { in: productIds }, isActive: true },
                select: { id: true },
            });
            if (products.length !== productIds.length) {
                return failure('INVALID_PRODUCT', 'พบประเภทเชื้อเพลิงที่ไม่มีหรือปิดใช้งาน');
            }
        }

        const dispenser = await tx.dispenser.create({
            data: {
                stationId: station.id,
                code: input.code,
                nozzles: input.nozzles.length > 0 ? {
                    create: input.nozzles.map((nozzle) => ({
                        code: nozzle.code,
                        productId: nozzle.productId,
                    })),
                } : undefined,
            },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: { product: { select: { id: true, name: true, code: true } } },
                },
            },
        });

        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'CREATE',
                model: 'Dispenser',
                recordId: dispenser.id,
                newData: {
                    stationId: station.id,
                    code: dispenser.code,
                    nozzleCount: dispenser.nozzles.length,
                },
            },
        });

        return { success: true, value: dispenser } as const;
    }, DISPENSER_WRITE_OPTIONS);
}

export async function updateDispenserAdmin(input: {
    stationId: string;
    dispenserId: string;
    code?: string;
    isActive?: boolean;
    userId: string;
}): Promise<MutationResult<unknown>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        const existing = await tx.dispenser.findFirst({
            where: { id: input.dispenserId, stationId: station.id, deletedAt: null },
            select: { id: true, code: true, isActive: true },
        });
        if (!existing) return failure('NOT_FOUND', 'ไม่พบตู้จ่าย');

        const dispenser = await tx.dispenser.update({
            where: { id: input.dispenserId },
            data: {
                ...(input.code !== undefined && { code: input.code }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    include: { product: { select: { id: true, name: true, code: true } } },
                },
            },
        });

        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'UPDATE',
                model: 'Dispenser',
                recordId: existing.id,
                oldData: { stationId: station.id, code: existing.code, isActive: existing.isActive },
                newData: { stationId: station.id, code: dispenser.code, isActive: dispenser.isActive },
            },
        });

        return { success: true, value: dispenser } as const;
    }, DISPENSER_WRITE_OPTIONS);
}

export async function deleteDispenserAdmin(input: {
    stationId: string;
    dispenserId: string;
    userId: string;
}): Promise<MutationResult<null>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        const existing = await tx.dispenser.findFirst({
            where: { id: input.dispenserId, stationId: station.id, deletedAt: null },
            include: {
                nozzles: {
                    where: { deletedAt: null },
                    select: { id: true, code: true, productId: true },
                },
            },
        });
        if (!existing) return failure('NOT_FOUND', 'ไม่พบตู้จ่าย');

        const deletedAt = new Date();
        await tx.nozzle.updateMany({
            where: { dispenserId: existing.id, deletedAt: null },
            data: { deletedAt },
        });
        await tx.dispenser.update({
            where: { id: existing.id },
            data: { deletedAt },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'DELETE',
                model: 'Dispenser',
                recordId: existing.id,
                oldData: {
                    stationId: station.id,
                    code: existing.code,
                    isActive: existing.isActive,
                    nozzles: existing.nozzles,
                },
                newData: { deletedAt: deletedAt.toISOString() },
            },
        });

        return { success: true, value: null } as const;
    }, DISPENSER_WRITE_OPTIONS);
}

export async function createNozzleAdmin(input: {
    stationId: string;
    dispenserId: string;
    code: string;
    productId: string;
    userId: string;
}): Promise<MutationResult<unknown>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        const [dispenser, product] = await Promise.all([
            tx.dispenser.findFirst({
                where: { id: input.dispenserId, stationId: station.id, deletedAt: null },
                select: { id: true },
            }),
            tx.fuelProduct.findFirst({
                where: { id: input.productId, isActive: true },
                select: { id: true },
            }),
        ]);
        if (!dispenser) return failure('NOT_FOUND', 'ไม่พบตู้จ่าย');
        if (!product) return failure('INVALID_PRODUCT', 'ไม่พบประเภทเชื้อเพลิงที่เปิดใช้งาน');

        const nozzle = await tx.nozzle.create({
            data: { dispenserId: dispenser.id, code: input.code, productId: product.id },
            include: { product: { select: { id: true, name: true, code: true } } },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'CREATE',
                model: 'Nozzle',
                recordId: nozzle.id,
                newData: {
                    stationId: station.id,
                    dispenserId: dispenser.id,
                    code: nozzle.code,
                    productId: nozzle.productId,
                },
            },
        });

        return { success: true, value: nozzle } as const;
    }, DISPENSER_WRITE_OPTIONS);
}

export async function updateNozzleAdmin(input: {
    stationId: string;
    dispenserId: string;
    nozzleId: string;
    code?: string;
    productId?: string;
    isActive?: boolean;
    userId: string;
}): Promise<MutationResult<unknown>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        const existing = await tx.nozzle.findFirst({
            where: {
                id: input.nozzleId,
                dispenserId: input.dispenserId,
                deletedAt: null,
                dispenser: { stationId: station.id, deletedAt: null },
            },
            select: { id: true, code: true, productId: true, isActive: true },
        });
        if (!existing) return failure('NOT_FOUND', 'ไม่พบหัวจ่าย');

        if (input.productId !== undefined) {
            const product = await tx.fuelProduct.findFirst({
                where: { id: input.productId, isActive: true },
                select: { id: true },
            });
            if (!product) return failure('INVALID_PRODUCT', 'ไม่พบประเภทเชื้อเพลิงที่เปิดใช้งาน');
        }

        const nozzle = await tx.nozzle.update({
            where: { id: existing.id },
            data: {
                ...(input.code !== undefined && { code: input.code }),
                ...(input.productId !== undefined && { productId: input.productId }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
            include: { product: { select: { id: true, name: true, code: true } } },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'UPDATE',
                model: 'Nozzle',
                recordId: existing.id,
                oldData: {
                    stationId: station.id,
                    dispenserId: input.dispenserId,
                    code: existing.code,
                    productId: existing.productId,
                    isActive: existing.isActive,
                },
                newData: {
                    stationId: station.id,
                    dispenserId: input.dispenserId,
                    code: nozzle.code,
                    productId: nozzle.productId,
                    isActive: nozzle.isActive,
                },
            },
        });

        return { success: true, value: nozzle } as const;
    }, DISPENSER_WRITE_OPTIONS);
}

export async function deleteNozzleAdmin(input: {
    stationId: string;
    dispenserId: string;
    nozzleId: string;
    userId: string;
}): Promise<MutationResult<null>> {
    const station = resolveActiveStation(input.stationId);
    if (!station) return failure('INVALID_STATION', 'สถานีนี้ไม่เปิดใช้งานสำหรับการจัดการหัวจ่าย');

    return prisma.$transaction(async (tx) => {
        const existing = await tx.nozzle.findFirst({
            where: {
                id: input.nozzleId,
                dispenserId: input.dispenserId,
                deletedAt: null,
                dispenser: { stationId: station.id, deletedAt: null },
            },
            select: { id: true, code: true, productId: true, isActive: true },
        });
        if (!existing) return failure('NOT_FOUND', 'ไม่พบหัวจ่าย');

        const deletedAt = new Date();
        await tx.nozzle.update({
            where: { id: existing.id },
            data: { deletedAt },
        });
        await tx.auditLog.create({
            data: {
                userId: input.userId,
                action: 'DELETE',
                model: 'Nozzle',
                recordId: existing.id,
                oldData: {
                    stationId: station.id,
                    dispenserId: input.dispenserId,
                    code: existing.code,
                    productId: existing.productId,
                    isActive: existing.isActive,
                },
                newData: { deletedAt: deletedAt.toISOString() },
            },
        });

        return { success: true, value: null } as const;
    }, DISPENSER_WRITE_OPTIONS);
}
