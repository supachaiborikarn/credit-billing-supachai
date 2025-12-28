/**
 * Device Service - Device Binding for Anti-Fraud
 * 
 * ผูกอุปกรณ์กับสถานี เพื่อรู้ว่าทำจากเครื่องไหน
 */

import { prisma } from '@/lib/prisma';

export interface DeviceInfo {
    deviceId: string;
    deviceName?: string;
    stationId?: string;
    userId?: string;
}

/**
 * ลงทะเบียนอุปกรณ์
 */
export async function registerDevice(
    deviceId: string,
    deviceName?: string,
    stationId?: string,
    userId?: string
): Promise<{ success: boolean; isNew: boolean; error?: string }> {
    try {
        // Check if device already exists
        const existing = await prisma.deviceToken.findUnique({
            where: { deviceId }
        });

        if (existing) {
            // Update last used
            await prisma.deviceToken.update({
                where: { deviceId },
                data: {
                    lastUsedAt: new Date(),
                    userId: userId || existing.userId,
                    stationId: stationId || existing.stationId
                }
            });
            return { success: true, isNew: false };
        }

        // Create new device
        await prisma.deviceToken.create({
            data: {
                deviceId,
                deviceName,
                stationId,
                userId,
                isActive: true
            }
        });

        return { success: true, isNew: true };
    } catch (error) {
        console.error('[DEVICE] Register error:', error);
        return { success: false, isNew: false, error: 'ลงทะเบียนอุปกรณ์ไม่สำเร็จ' };
    }
}

/**
 * ตรวจสอบว่าอุปกรณ์นี้ผูกกับสถานีที่ระบุหรือไม่
 */
export async function validateDeviceStation(
    deviceId: string,
    stationId: string
): Promise<{ valid: boolean; error?: string }> {
    const device = await prisma.deviceToken.findUnique({
        where: { deviceId }
    });

    if (!device) {
        return { valid: false, error: 'อุปกรณ์นี้ยังไม่ได้ลงทะเบียน' };
    }

    if (!device.isActive) {
        return { valid: false, error: 'อุปกรณ์นี้ถูกระงับการใช้งาน' };
    }

    if (device.stationId && device.stationId !== stationId) {
        return { valid: false, error: 'อุปกรณ์นี้ไม่ได้ผูกกับสถานีนี้' };
    }

    return { valid: true };
}

/**
 * นับจำนวนอุปกรณ์ที่ผูกกับสถานี
 */
export async function countDevicesForStation(stationId: string): Promise<number> {
    return await prisma.deviceToken.count({
        where: {
            stationId,
            isActive: true
        }
    });
}

/**
 * ตรวจสอบว่าเกินจำนวนอุปกรณ์ที่อนุญาตหรือไม่ (default: 2 เครื่อง/สถานี)
 */
export async function isDeviceLimitExceeded(
    stationId: string,
    maxDevices: number = 2
): Promise<boolean> {
    const count = await countDevicesForStation(stationId);
    return count >= maxDevices;
}

/**
 * ยกเลิกการผูกอุปกรณ์
 */
export async function deactivateDevice(deviceId: string): Promise<{ success: boolean }> {
    try {
        await prisma.deviceToken.update({
            where: { deviceId },
            data: { isActive: false }
        });
        return { success: true };
    } catch {
        return { success: false };
    }
}

/**
 * ดึงรายการอุปกรณ์ของสถานี
 */
export async function getStationDevices(stationId: string) {
    return await prisma.deviceToken.findMany({
        where: {
            stationId,
            isActive: true
        },
        include: {
            user: {
                select: { id: true, name: true }
            }
        },
        orderBy: { lastUsedAt: 'desc' }
    });
}

/**
 * สร้าง Device ID (ถ้ายังไม่มี)
 * ใช้ใน frontend
 */
export function generateDeviceId(): string {
    return crypto.randomUUID();
}
