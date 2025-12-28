/**
 * Audit Service - บันทึกประวัติการเปลี่ยนแปลงทุกอย่าง
 */

import { prisma } from '@/lib/prisma';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID' | 'CLOSE' | 'LOCK' | 'LOGIN' | 'LOGOUT';
export type AuditModel = 'Transaction' | 'Shift' | 'MeterReading' | 'DailyRecord' | 'User' | 'Owner' | 'Truck';

interface AuditLogInput {
    userId: string;
    action: AuditAction;
    model: AuditModel;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    ipAddress?: string;
}

/**
 * บันทึก Audit Log
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: input.userId,
                action: input.action,
                model: input.model,
                recordId: input.recordId,
                oldData: input.oldData ? JSON.parse(JSON.stringify(input.oldData)) : undefined,
                newData: input.newData ? JSON.parse(JSON.stringify(input.newData)) : undefined,
                ipAddress: input.ipAddress || null,
            }
        });
    } catch (error) {
        // Don't fail the main operation if audit logging fails
        console.error('[AUDIT] Failed to create audit log:', error);
    }
}

/**
 * บันทึก audit สำหรับ Transaction
 */
export async function auditTransaction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID',
    userId: string,
    recordId: string,
    oldData?: Record<string, unknown> | null,
    newData?: Record<string, unknown> | null,
    ipAddress?: string
): Promise<void> {
    await createAuditLog({
        userId,
        action,
        model: 'Transaction',
        recordId,
        oldData,
        newData,
        ipAddress
    });
}

/**
 * บันทึก audit สำหรับ Shift
 */
export async function auditShift(
    action: 'CREATE' | 'CLOSE' | 'LOCK',
    userId: string,
    recordId: string,
    oldData?: Record<string, unknown> | null,
    newData?: Record<string, unknown> | null,
    ipAddress?: string
): Promise<void> {
    await createAuditLog({
        userId,
        action,
        model: 'Shift',
        recordId,
        oldData,
        newData,
        ipAddress
    });
}

/**
 * ดึงประวัติ Audit Log ตาม recordId
 */
export async function getAuditHistory(model: AuditModel, recordId: string) {
    return prisma.auditLog.findMany({
        where: {
            model,
            recordId
        },
        include: {
            user: {
                select: { id: true, name: true, username: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * ดึง Audit Log ทั้งหมดตามวันที่
 */
export async function getAuditLogsByDate(date: Date, stationId?: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.auditLog.findMany({
        where: {
            createdAt: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        include: {
            user: {
                select: { id: true, name: true, username: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Format audit log สำหรับแสดงผล
 */
export function formatAuditAction(action: AuditAction): string {
    const actionLabels: Record<AuditAction, string> = {
        CREATE: 'สร้าง',
        UPDATE: 'แก้ไข',
        DELETE: 'ลบ',
        VOID: 'ยกเลิก',
        CLOSE: 'ปิด',
        LOCK: 'ล็อก',
        LOGIN: 'เข้าสู่ระบบ',
        LOGOUT: 'ออกจากระบบ'
    };
    return actionLabels[action] || action;
}

export function formatAuditModel(model: AuditModel): string {
    const modelLabels: Record<AuditModel, string> = {
        Transaction: 'รายการ',
        Shift: 'กะ',
        MeterReading: 'มิเตอร์',
        DailyRecord: 'บันทึกประจำวัน',
        User: 'ผู้ใช้',
        Owner: 'เจ้าของรถ',
        Truck: 'รถ'
    };
    return modelLabels[model] || model;
}
