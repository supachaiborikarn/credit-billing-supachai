export type StationAuditEntityType = 'TRANSACTION' | 'METER' | 'DAILY_RECORD' | 'SHIFT';

export interface StationAuditRecordMeta {
    entityType: StationAuditEntityType;
    closedAt?: Date | string | null;
}

export interface RawStationAuditLog {
    id: string;
    userId: string;
    action: string;
    model: string;
    recordId: string;
    oldData: unknown;
    newData: unknown;
    createdAt: Date | string;
    user?: { name: string | null } | null;
}

export interface StationAuditChange {
    field: string;
    oldValue: string;
    newValue: string;
}

export interface StationAuditEntry {
    id: string;
    timestamp: string;
    action: string;
    entityType: StationAuditEntityType;
    entityId: string;
    userId: string;
    userName: string;
    changes: StationAuditChange[];
    isPostClose: boolean;
    reason?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function formatAuditValue(value: unknown): string {
    if (value === undefined) return '';
    if (value === null) return '-';
    if (typeof value === 'string') return value || '-';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function buildStationAuditChanges(oldData: unknown, newData: unknown): StationAuditChange[] {
    const oldRecord = asRecord(oldData);
    const newRecord = asRecord(newData);
    const keys = [...new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])].sort();

    return keys.flatMap((field) => {
        const oldValue = formatAuditValue(oldRecord[field]);
        const newValue = formatAuditValue(newRecord[field]);
        return oldValue === newValue ? [] : [{ field, oldValue, newValue }];
    });
}

function extractReason(newData: unknown): string | undefined {
    const record = asRecord(newData);
    for (const key of ['voidReason', 'reason', 'varianceNote', 'anomalyNote', 'note']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
}

export function buildStationAuditEntries(
    logs: RawStationAuditLog[],
    recordMeta: ReadonlyMap<string, StationAuditRecordMeta>
): StationAuditEntry[] {
    return logs.flatMap((log) => {
        const meta = recordMeta.get(log.recordId);
        if (!meta) return [];

        const timestamp = new Date(log.createdAt);
        const closedAt = meta.closedAt ? new Date(meta.closedAt) : null;
        const isPostClose = log.action !== 'CLOSE' && Boolean(
            closedAt
            && Number.isFinite(closedAt.getTime())
            && Number.isFinite(timestamp.getTime())
            && timestamp.getTime() > closedAt.getTime()
        );
        const reason = extractReason(log.newData);

        return [{
            id: log.id,
            timestamp: Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : String(log.createdAt),
            action: log.action,
            entityType: meta.entityType,
            entityId: log.recordId,
            userId: log.userId,
            userName: log.user?.name?.trim() || log.userId,
            changes: buildStationAuditChanges(log.oldData, log.newData),
            isPostClose,
            ...(reason ? { reason } : {}),
        }];
    });
}
