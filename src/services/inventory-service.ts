/**
 * Inventory Service
 * 
 * จัดการสินค้าคงคลังและยอดขายสินค้าอื่นๆ (นอกเหนือจากน้ำมัน/แก๊ส)
 * - คำนวณยอดขายสินค้าต่อกะ
 * - ตรวจสอบสต็อกต่ำ
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PRODUCT_INVENTORY_STATION_IDS, isProductInventoryStationId } from '@/lib/inventory-scope';

/**
 * คำนวณยอดขายสินค้าอื่น (ไม่รวมน้ำมัน/แก๊ส) ต่อกะ
 * @param shiftId Shift ID
 * @returns ยอดรวมเป็นบาท
 */
export async function calculateProductSales(shiftId: string): Promise<number> {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            dailyRecord: {
                select: {
                    stationId: true,
                    date: true
                }
            }
        }
    });

    if (!shift || !shift.dailyRecord) {
        return 0;
    }

    // Get start/end time for this shift
    const shiftStartTime = shift.createdAt;
    const shiftEndTime = shift.closedAt || new Date();

    // Calculate product sales during this shift's time window
    const sales = await prisma.productSale.aggregate({
        where: {
            stationId: shift.dailyRecord.stationId,
            date: {
                gte: shiftStartTime,
                lte: shiftEndTime
            }
        },
        _sum: {
            salePrice: true
        }
    });

    // Sum of (quantity * salePrice) - but salePrice is already total
    return Number(sales._sum.salePrice || 0);
}

export interface LowStockItem {
    productId: string;
    productName: string;
    currentStock: number;
    alertLevel: number;
    percentRemaining: number;
}

/**
 * ตรวจสอบสินค้าที่สต็อกต่ำกว่า alert level
 * @param stationId (optional) กรองตามสถานี
 * @returns รายการสินค้าที่สต็อกต่ำ
 */
export async function checkLowStock(stationId?: string): Promise<LowStockItem[]> {
    // Get all products with inventory
    const inventories = await prisma.productInventory.findMany({
        where: {
            stationId: stationId
                ? stationId
                : { in: PRODUCT_INVENTORY_STATION_IDS },
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    const lowStockItems: LowStockItem[] = [];

    for (const inv of inventories) {
        const alertLevel = Number(inv.alertLevel ?? 10);
        const currentStock = Number(inv.quantity);

        if (currentStock <= alertLevel) {
            lowStockItems.push({
                productId: inv.product.id,
                productName: inv.product.name,
                currentStock,
                alertLevel,
                percentRemaining: alertLevel > 0 ? (currentStock / alertLevel) * 100 : 0
            });
        }
    }

    // Sort by percentRemaining (lowest first = most urgent)
    return lowStockItems.sort((a, b) => a.percentRemaining - b.percentRemaining);
}

/**
 * ดึงสรุปสินค้าคงคลังของสถานี
 * @param stationId Station ID
 */
export async function getStationInventorySummary(stationId: string) {
    const inventories = await prisma.productInventory.findMany({
        where: { stationId },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    salePrice: true
                }
            }
        }
    });

    return inventories.map(inv => ({
        productId: inv.product.id,
        productName: inv.product.name,
        unit: inv.product.unit,
        price: Number(inv.product.salePrice),
        currentStock: Number(inv.quantity),
        alertLevel: Number(inv.alertLevel ?? 10),
        isLowStock: Number(inv.quantity) <= Number(inv.alertLevel ?? 10),
        totalValue: Number(inv.quantity) * Number(inv.product.salePrice)
    }));
}

/**
 * ปรับยอดสต็อกโดยแอดมิน (ไม่สร้าง receipt/sale ปลอม)
 */
const INVENTORY_ADJUST_WRITE_OPTIONS = {
    maxWait: 5000,
    timeout: 20000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export interface InventoryAdjustmentResult {
    success: boolean;
    inventoryId?: string;
    previousQuantity?: number;
    newQuantity: number;
    error?: string;
    code?: 'NOT_FOUND' | 'INVALID_STATION' | 'INVALID_QUANTITY' | 'INSUFFICIENT_STOCK' | 'CONFLICT';
}

export async function adjustInventory(
    stationId: string,
    productId: string,
    quantityChange: number,
    userId: string,
    reason: string
): Promise<InventoryAdjustmentResult> {
    if (!isProductInventoryStationId(stationId)) {
        return { success: false, newQuantity: 0, error: 'สถานีนี้ไม่รองรับสต็อกสินค้า', code: 'INVALID_STATION' };
    }
    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
        return { success: false, newQuantity: 0, error: 'จำนวนปรับต้องเป็นจำนวนเต็มและไม่เท่ากับ 0', code: 'INVALID_QUANTITY' };
    }

    try {
        return await prisma.$transaction(async (tx) => {
            const inventory = await tx.productInventory.findUnique({
                where: { productId_stationId: { productId, stationId } },
                include: { product: { select: { name: true } } },
            });

            if (!inventory) {
                return { success: false, newQuantity: 0, error: 'ไม่พบสินค้าในสต็อกสถานีนี้', code: 'NOT_FOUND' } as InventoryAdjustmentResult;
            }

            const previousQuantity = Number(inventory.quantity);
            const newQuantity = previousQuantity + quantityChange;
            if (newQuantity < 0) {
                return {
                    success: false,
                    inventoryId: inventory.id,
                    previousQuantity,
                    newQuantity: previousQuantity,
                    error: `สต็อกไม่เพียงพอ (มี ${previousQuantity} จะลด ${Math.abs(quantityChange)})`,
                    code: 'INSUFFICIENT_STOCK',
                } as InventoryAdjustmentResult;
            }

            await tx.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: newQuantity },
            });
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'ADJUST',
                    model: 'ProductInventory',
                    recordId: inventory.id,
                    oldData: {
                        stationId,
                        productId,
                        productName: inventory.product.name,
                        quantity: previousQuantity,
                    },
                    newData: {
                        stationId,
                        productId,
                        productName: inventory.product.name,
                        quantity: newQuantity,
                        quantityChange,
                        reason,
                    },
                },
            });

            return {
                success: true,
                inventoryId: inventory.id,
                previousQuantity,
                newQuantity,
            };
        }, INVENTORY_ADJUST_WRITE_OPTIONS);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
            return { success: false, newQuantity: 0, error: 'สต็อกถูกแก้ไขพร้อมกัน กรุณารีเฟรชแล้วลองใหม่', code: 'CONFLICT' };
        }
        console.error('[INVENTORY] Adjust error:', error);
        return { success: false, newQuantity: 0, error: 'เกิดข้อผิดพลาดในการปรับสต็อก' };
    }
}
