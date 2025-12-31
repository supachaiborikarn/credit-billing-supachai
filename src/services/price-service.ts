/**
 * Price Book Service - ราคาน้ำมันตามนโยบาย
 * 
 * - เปลี่ยนราคาตาม effective date
 * - คำนวณราคาฝั่ง server (ป้องกันการปั้นตัวเลข)
 */

import { prisma } from '@/lib/prisma';

export interface PriceInfo {
    productType: string;
    retailPrice: number;
    wholesalePrice?: number;
    effectiveFrom: Date;
}

/**
 * ดึงราคาที่ใช้ ณ ขณะนี้
 * ใช้เวลา 05:00 เป็นจุดเปลี่ยนวัน (ตาม policy ปั๊ม)
 */
export async function getCurrentPrice(
    productType: string,
    stationId?: string,
    referenceTime?: Date
): Promise<PriceInfo | null> {
    const now = referenceTime || new Date();

    // หาราคาที่ effective แล้วและยังไม่หมดอายุ
    const price = await prisma.priceBook.findFirst({
        where: {
            productType,
            stationId: stationId || null,
            effectiveFrom: { lte: now },
            OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: now } }
            ]
        },
        orderBy: { effectiveFrom: 'desc' }
    });

    if (!price) {
        // Fallback: หาราคาล่าสุด
        const latestPrice = await prisma.priceBook.findFirst({
            where: {
                productType,
                stationId: stationId || null
            },
            orderBy: { effectiveFrom: 'desc' }
        });

        if (!latestPrice || !latestPrice.productType || !latestPrice.retailPrice) return null;

        return {
            productType: latestPrice.productType,
            retailPrice: Number(latestPrice.retailPrice),
            wholesalePrice: latestPrice.wholesalePrice ? Number(latestPrice.wholesalePrice) : undefined,
            effectiveFrom: latestPrice.effectiveFrom
        };
    }

    if (!price || !price.productType || !price.retailPrice) return null;

    return {
        productType: price.productType,
        retailPrice: Number(price.retailPrice),
        wholesalePrice: price.wholesalePrice ? Number(price.wholesalePrice) : undefined,
        effectiveFrom: price.effectiveFrom
    };
}

/**
 * คำนวณยอดเงินจากจำนวนลิตร (server-side)
 * ใช้ราคาจาก price book เท่านั้น
 */
export async function calculateAmount(
    productType: string,
    liters: number,
    stationId?: string,
    isWholesale: boolean = false
): Promise<{ amount: number; price: number; priceType: 'retail' | 'wholesale' }> {
    const priceInfo = await getCurrentPrice(productType, stationId);

    if (!priceInfo) {
        throw new Error(`ไม่พบราคาสำหรับ ${productType}`);
    }

    const price = isWholesale && priceInfo.wholesalePrice
        ? priceInfo.wholesalePrice
        : priceInfo.retailPrice;

    return {
        amount: liters * price,
        price,
        priceType: isWholesale && priceInfo.wholesalePrice ? 'wholesale' : 'retail'
    };
}

/**
 * ตั้งราคาใหม่
 */
export async function setPrice(
    productType: string,
    retailPrice: number,
    wholesalePrice?: number,
    stationId?: string,
    effectiveFrom?: Date,
    userId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        // ปิดราคาเก่า
        const now = effectiveFrom || new Date();

        await prisma.priceBook.updateMany({
            where: {
                productType,
                stationId: stationId || null,
                effectiveTo: null
            },
            data: {
                effectiveTo: now
            }
        });

        // สร้างราคาใหม่
        const newPrice = await prisma.priceBook.create({
            data: {
                productType,
                retailPrice,
                wholesalePrice,
                stationId,
                effectiveFrom: now,
                createdById: userId
            }
        });

        return { success: true, id: newPrice.id };
    } catch (error) {
        console.error('[PRICE] Set price error:', error);
        return { success: false, error: 'ตั้งราคาไม่สำเร็จ' };
    }
}

/**
 * ดึงประวัติราคา
 */
export async function getPriceHistory(
    productType: string,
    stationId?: string,
    limit: number = 10
): Promise<PriceInfo[]> {
    const prices = await prisma.priceBook.findMany({
        where: {
            productType,
            stationId: stationId || null
        },
        orderBy: { effectiveFrom: 'desc' },
        take: limit
    });

    return prices
        .filter(p => p.productType && p.retailPrice)
        .map(p => ({
            productType: p.productType!,
            retailPrice: Number(p.retailPrice),
            wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
            effectiveFrom: p.effectiveFrom
        }));
}

/**
 * Product types ที่รองรับ
 */
export const PRODUCT_TYPES = {
    GAS: 'GAS',           // แก๊ส LPG
    DIESEL: 'DIESEL',     // ดีเซล
    DIESEL_B7: 'DIESEL_B7',
    GASOHOL_95: 'GASOHOL_95',
    GASOHOL_91: 'GASOHOL_91',
    E20: 'E20',
    E85: 'E85',
} as const;
