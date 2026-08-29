export interface FullHistoryDailyRecordState {
    status?: string | null;
    meterShiftId?: string | null;
    meterShiftStatus?: string | null;
}

export function canCreateFullHistoryTransaction(
    dailyRecord: FullHistoryDailyRecordState | null | undefined
): boolean {
    return Boolean(
        dailyRecord
        && dailyRecord.status === 'OPEN'
        && dailyRecord.meterShiftStatus === 'OPEN'
        && dailyRecord.meterShiftId
    );
}
