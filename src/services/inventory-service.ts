/**
 * Inventory Service
 * 
 * จัดการสินค้าคงคลังและยอดขายสินค้าอื่นๆ (นอกเหนือจากน้ำมัน/แก๊ส)
 * - คำนวณยอดขายสินค้าต่อกะ
 * - ตรวจสอบสต็อกต่ำ
 */

import { prisma } from '@/lib/prisma';

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
            quantity: { gt: 0 },
            ...(stationId && { stationId })
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
        const alertLevel = Number(inv.alertLevel || 10);
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
        alertLevel: Number(inv.alertLevel || 10),
        isLowStock: Number(inv.quantity) <= Number(inv.alertLevel || 10),
        totalValue: Number(inv.quantity) * Number(inv.product.salePrice)
    }));
}

/**
 * อัปเดตสต็อกสินค้า (เพิ่มหรือลด)
 * @param stationId Station ID
 * @param productId Product ID
 * @param quantityChange จำนวนที่เปลี่ยน (บวก = เพิ่ม, ลบ = ลด)
 */
export async function updateInventory(
    stationId: string,
    productId: string,
    quantityChange: number
): Promise<{ success: boolean; newQuantity: number; error?: string }> {
    try {
        const inventory = await prisma.productInventory.findFirst({
            where: { stationId, productId }
        });

        if (!inventory) {
            // Create new inventory record
            const newInv = await prisma.productInventory.create({
                data: {
                    stationId,
                    productId,
                    quantity: Math.max(0, quantityChange)
                }
            });
            return { success: true, newQuantity: Number(newInv.quantity) };
        }

        const currentQty = Number(inventory.quantity);
        const newQty = currentQty + quantityChange;

        if (newQty < 0) {
            return {
                success: false,
                newQuantity: currentQty,
                error: `สต็อกไม่เพียงพอ (มี ${currentQty} จะลด ${Math.abs(quantityChange)})`
            };
        }

        const updated = await prisma.productInventory.update({
            where: { id: inventory.id },
            data: { quantity: newQty }
        });

        return { success: true, newQuantity: Number(updated.quantity) };
    } catch (error) {
        console.error('[INVENTORY] Update error:', error);
        return { success: false, newQuantity: 0, error: 'เกิดข้อผิดพลาด' };
    }
}
