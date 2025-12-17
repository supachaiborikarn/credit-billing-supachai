import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogParams {
    userId: string;
    action: AuditAction;
    model: string;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    ipAddress?: string;
}

/**
 * Log an audit event for tracking CRUD operations
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                model: params.model,
                recordId: params.recordId,
                oldData: params.oldData ? (params.oldData as Prisma.InputJsonValue) : undefined,
                newData: params.newData ? (params.newData as Prisma.InputJsonValue) : undefined,
                ipAddress: params.ipAddress || undefined,
            }
        });
    } catch (error) {
        // Don't let audit logging failures break the main operation
        console.error('[AUDIT] Failed to log audit event:', error);
    }
}

/**
 * Helper to create audit log for CREATE operations
 */
export async function auditCreate(userId: string, model: string, recordId: string, newData: Record<string, unknown>) {
    return logAudit({ userId, action: 'CREATE', model, recordId, newData });
}

/**
 * Helper to create audit log for UPDATE operations
 */
export async function auditUpdate(userId: string, model: string, recordId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>) {
    return logAudit({ userId, action: 'UPDATE', model, recordId, oldData, newData });
}

/**
 * Helper to create audit log for DELETE operations
 */
export async function auditDelete(userId: string, model: string, recordId: string, oldData: Record<string, unknown>) {
    return logAudit({ userId, action: 'DELETE', model, recordId, oldData });
}
