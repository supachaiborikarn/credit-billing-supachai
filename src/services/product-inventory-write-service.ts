import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const PRODUCT_INVENTORY_WRITE_OPTIONS = {
    maxWait: 5000,
    timeout: 20000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

const MAX_INT_QUANTITY = 2_000_000_000;

type MutationFailure = {
    success: false;
    status: number;
    error: string;
    code?: 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT';
};

type MutationSuccess<T> = {
    success: true;
    value: T;
};

export type ProductInventoryWriteResult<T> = MutationSuccess<T> | MutationFailure;

function failure(status: number, error: string, code?: MutationFailure['code']): MutationFailure {
    return { success: false, status, error, code };
}

function parseNumericInput(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return Number.NaN;
}

export function parseNonNegativeInventoryInteger(value: unknown, label: string): { value: number } | { error: string } {
    const parsed = parseNumericInput(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_INT_QUANTITY) {
        return { error: `${label}ต้องเป็นจำนวนเต็มไม่ติดลบ` };
    }
    return { value: parsed };
}

export function parsePositiveInventoryInteger(value: unknown, label: string): { value: number } | { error: string } {
    const parsed = parseNumericInput(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_INT_QUANTITY) {
        return { error: `${label}ต้องเป็นจำนวนเต็มมากกว่า 0` };
    }
    return { value: parsed };
}

export function parsePositivePrice(value: unknown, label = 'ราคาขาย'): { value: number } | { error: string } {
    const parsed = parseNumericInput(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000_000) {
        return { error: `${label}ต้องเป็นตัวเลขมากกว่า 0` };
    }
    return { value: parsed };
}

export function parseOptionalNonNegativePrice(value: unknown, label = 'ราคาทุน'): { value: number | null } | { error: string } {
    if (value === undefined || value === null || value === '') return { value: null };
    const parsed = parseNumericInput(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) {
        return { error: `${label}ต้องเป็นตัวเลขไม่ติดลบ` };
    }
    return { value: parsed };
}

export async function createStationProduct(input: {
    stationId: string;
    userId: string;
    name: string;
    unit: string;
    salePrice: number;
    costPrice: number | null;
    quantity: number;
    alertLevel: number | null;
}): Promise<ProductInventoryWriteResult<unknown>> {
    try {
        return await prisma.$transaction(async (tx) => {
            const station = await tx.station.findUnique({
                where: { id: input.stationId },
                select: { id: true, hasProducts: true },
            });
            if (!station || !station.hasProducts) {
                return failure(404, 'ไม่พบสถานีที่เปิดใช้งานสินค้าเสริม', 'NOT_FOUND');
            }

            const product = await tx.product.create({
                data: {
                    name: input.name,
                    unit: input.unit,
                    salePrice: input.salePrice,
                    costPrice: input.costPrice,
                },
            });
            const inventory = await tx.productInventory.create({
                data: {
                    stationId: input.stationId,
                    productId: product.id,
                    quantity: input.quantity,
                    alertLevel: input.alertLevel,
                },
                include: { product: true },
            });

            if (input.quantity > 0) {
                await tx.productReceipt.create({
                    data: {
                        productId: product.id,
                        stationId: input.stationId,
                        quantity: input.quantity,
                        costPrice: input.costPrice,
                    },
                });
            }

            await tx.auditLog.create({
                data: {
                    userId: input.userId,
                    action: 'CREATE',
                    model: 'ProductInventory',
                    recordId: inventory.id,
                    newData: {
                        stationId: input.stationId,
                        productId: product.id,
                        name: input.name,
                        unit: input.unit,
                        salePrice: input.salePrice,
                        costPrice: input.costPrice,
                        quantity: input.quantity,
                        alertLevel: input.alertLevel,
                    },
                },
            });

            return { success: true, value: inventory } as const;
        }, PRODUCT_INVENTORY_WRITE_OPTIONS);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
            return failure(409, 'ข้อมูลสินค้าเปลี่ยนพร้อมกัน กรุณารีเฟรชแล้วลองใหม่', 'CONFLICT');
        }
        throw error;
    }
}

export async function updateStationProduct(input: {
    stationId: string;
    userId: string;
    productId: string;
    salePrice: number;
    alertLevel: number | null;
}): Promise<ProductInventoryWriteResult<{ success: true }>> {
    try {
        return await prisma.$transaction(async (tx) => {
            const station = await tx.station.findUnique({
                where: { id: input.stationId },
                select: { id: true, hasProducts: true },
            });
            if (!station || !station.hasProducts) {
                return failure(404, 'ไม่พบสถานีที่เปิดใช้งานสินค้าเสริม', 'NOT_FOUND');
            }

            const inventory = await tx.productInventory.findUnique({
                where: { productId_stationId: { productId: input.productId, stationId: input.stationId } },
                include: { product: true },
            });
            if (!inventory) return failure(404, 'ไม่พบสินค้าในสต็อก', 'NOT_FOUND');

            await tx.product.update({
                where: { id: input.productId },
                data: { salePrice: input.salePrice },
            });
            await tx.productInventory.update({
                where: { id: inventory.id },
                data: { alertLevel: input.alertLevel },
            });
            await tx.auditLog.create({
                data: {
                    userId: input.userId,
                    action: 'UPDATE',
                    model: 'ProductInventory',
                    recordId: inventory.id,
                    oldData: {
                        stationId: input.stationId,
                        productId: input.productId,
                        salePrice: Number(inventory.product.salePrice),
                        alertLevel: inventory.alertLevel,
                    },
                    newData: {
                        stationId: input.stationId,
                        productId: input.productId,
                        salePrice: input.salePrice,
                        alertLevel: input.alertLevel,
                    },
                },
            });

            return { success: true, value: { success: true } } as const;
        }, PRODUCT_INVENTORY_WRITE_OPTIONS);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
            return failure(409, 'ข้อมูลสินค้าเปลี่ยนพร้อมกัน กรุณารีเฟรชแล้วลองใหม่', 'CONFLICT');
        }
        throw error;
    }
}

export async function receiveStationProduct(input: {
    stationId: string;
    userId: string;
    productId: string;
    quantity: number;
}): Promise<ProductInventoryWriteResult<{ newQuantity: number }>> {
    try {
        return await prisma.$transaction(async (tx) => {
            const station = await tx.station.findUnique({
                where: { id: input.stationId },
                select: { id: true, hasProducts: true },
            });
            if (!station || !station.hasProducts) {
                return failure(404, 'ไม่พบสถานีที่เปิดใช้งานสินค้าเสริม', 'NOT_FOUND');
            }

            const inventory = await tx.productInventory.findUnique({
                where: { productId_stationId: { productId: input.productId, stationId: input.stationId } },
                select: { id: true, productId: true, quantity: true },
            });
            if (!inventory) return failure(404, 'ไม่พบสินค้าในสต็อก', 'NOT_FOUND');
            if (inventory.quantity > MAX_INT_QUANTITY - input.quantity) {
                return failure(400, 'จำนวนคงเหลือหลังรับเข้ามากเกินขอบเขตที่รองรับ', 'INVALID_INPUT');
            }

            const updated = await tx.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: { increment: input.quantity } },
                select: { quantity: true },
            });
            await tx.productReceipt.create({
                data: {
                    productId: input.productId,
                    stationId: input.stationId,
                    quantity: input.quantity,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: input.userId,
                    action: 'UPDATE',
                    model: 'ProductInventory',
                    recordId: inventory.id,
                    oldData: {
                        stationId: input.stationId,
                        productId: input.productId,
                        quantity: inventory.quantity,
                    },
                    newData: {
                        stationId: input.stationId,
                        productId: input.productId,
                        quantity: updated.quantity,
                        receivedQuantity: input.quantity,
                        source: 'RECEIVE',
                    },
                },
            });

            return { success: true, value: { newQuantity: updated.quantity } } as const;
        }, PRODUCT_INVENTORY_WRITE_OPTIONS);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
            return failure(409, 'ข้อมูลสต็อกเปลี่ยนพร้อมกัน กรุณารีเฟรชแล้วลองใหม่', 'CONFLICT');
        }
        throw error;
    }
}
