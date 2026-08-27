export type StationHistoryStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface StationHistoryMeter {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    soldQty: number | null;
    startPhoto: string | null;
    endPhoto: string | null;
}

export interface StationHistoryGauge {
    tankNumber: number;
    startPercentage: number | null;
    endPercentage: number | null;
    startPhoto: string | null;
    endPhoto: string | null;
}

export interface StationHistoryAnomaly {
    id: string;
    nozzleNumber: number;
    soldQty: number;
    averageQty: number;
    percentDiff: number;
    severity: string;
    note: string | null;
    reviewedAt: string | null;
    createdAt: string;
}

export interface StationHistoryDailyAnomaly {
    id: string;
    date: string;
    meterTotal: number;
    transactionTotal: number;
    difference: number;
    severity: string;
    note: string | null;
    reviewedAt: string | null;
}

export interface StationHistoryReconciliation {
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    totalExpected: number;
    totalReceived: number;
    cashReceived: number;
    creditReceived: number;
    transferReceived: number;
    productSalesAmount: number;
    productTransferAmount: number;
    otherIncomeAmount: number;
    otherIncomeNote: string | null;
    otherExpensesAmount: number;
    otherExpenseNote: string | null;
    variance: number;
    varianceStatus: 'GREEN' | 'YELLOW' | 'RED';
}

export type StationHistoryAttentionReason =
    | 'OPEN_SHIFT'
    | 'METER_ANOMALY'
    | 'DAILY_ANOMALY'
    | 'RECONCILIATION_VARIANCE';

export interface StationHistoryShift {
    id: string;
    businessDate: string;
    shiftNumber: number;
    status: StationHistoryStatus;
    openedAt: string;
    closedAt: string | null;
    staffName: string | null;
    closedByName: string | null;
    varianceNote: string | null;
    gasPrice: number | null;
    meters: StationHistoryMeter[];
    gauges: StationHistoryGauge[];
    totalMeterLiters: number;
    transactionCount: number;
    transactionLiters: number;
    transactionAmount: number;
    anomalies: StationHistoryAnomaly[];
    dailyAnomaly: StationHistoryDailyAnomaly | null;
    reconciliation: StationHistoryReconciliation | null;
    attentionReasons: StationHistoryAttentionReason[];
}

export interface StationHistoryResponse {
    station: {
        id: string;
        name: string;
        type: 'FULL' | 'SIMPLE' | 'GAS';
        operationalStatus: 'ACTIVE' | 'RETIRED';
    };
    filters: {
        from: string;
        to: string;
        status: 'ALL' | StationHistoryStatus;
        attentionOnly: boolean;
    };
    summary: {
        shifts: number;
        openShifts: number;
        attentionShifts: number;
        meterAnomalies: number;
        dailyAnomalies: number;
    };
    shifts: StationHistoryShift[];
}
