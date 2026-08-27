export type TodayStationState =
    | 'NO_SHIFT'
    | 'SHIFT_OPEN'
    | 'SHIFT_NEEDS_ATTENTION'
    | 'READY_TO_CLOSE'
    | 'STALE_SHIFT'
    | 'CLOSED'
    | 'RETIRED';

export type TodaySeverity = 'info' | 'warning' | 'critical';

export interface TodayUser {
    id: string;
    name: string;
    role: 'ADMIN' | 'STAFF';
    stationId: string | null;
    stationName: string | null;
    stationType: 'FULL' | 'SIMPLE' | 'GAS' | null;
}

export interface TodayPrimaryAction {
    label: string;
    href: string;
}

export interface TodayWorkItem {
    id: string;
    type:
        | 'STALE_SHIFT'
        | 'MISSING_OPENING_DATA'
        | 'MISSING_CLOSING_DATA'
        | 'METER_ANOMALY'
        | 'DAILY_ANOMALY'
        | 'MISSING_TRANSFER_PROOF'
        | 'INCOMPLETE_CREDIT'
        | 'UNLINKED_TRANSACTION'
        | 'RECONCILIATION_VARIANCE';
    severity: TodaySeverity;
    title: string;
    detail?: string;
    href?: string;
    stationId?: string;
    stationName?: string;
}

export interface TodayShiftSummary {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    businessDate: string;
}

export interface TodayTransaction {
    id: string;
    stationId: string;
    stationName: string;
    date: string;
    licensePlate: string | null;
    ownerName: string | null;
    paymentType: string;
    liters: number;
    amount: number;
}

export interface TodaySummary {
    transactionCount: number;
    liters: number;
    amount: number;
}

export interface TodayStationSnapshot {
    stationId: string;
    stationName: string;
    stationType: 'FULL' | 'GAS';
    stationNumber: number;
    state: Exclude<TodayStationState, 'RETIRED'>;
    stateLabel: string;
    shift: TodayShiftSummary | null;
    primaryAction: TodayPrimaryAction;
    workItems: TodayWorkItem[];
    summary: TodaySummary;
    recentTransactions: TodayTransaction[];
    href: string;
}

export interface TodayBillingAttention {
    readyToInvoice: {
        transactionCount: number;
        amount: number;
    };
    invoiceAwaitingPayment: {
        documentCount: number;
        amount: number;
    };
    collectionAwaitingPayment: {
        documentCount: number;
        amount: number;
    };
    overdueDocuments: number;
    pendingPaymentSlips: number;
}

export interface TodayStaffPayload {
    kind: 'staff';
    dateKey: string;
    user: TodayUser;
    station: {
        stationId: string;
        stationName: string;
        stationType: 'FULL' | 'SIMPLE' | 'GAS';
        stationNumber: number;
    };
    state: TodayStationState;
    stateLabel: string;
    shift: TodayShiftSummary | null;
    primaryAction: TodayPrimaryAction;
    workItems: TodayWorkItem[];
    summary: TodaySummary;
    recentTransactions: TodayTransaction[];
}

export interface TodayAdminPayload {
    kind: 'admin';
    dateKey: string;
    user: TodayUser;
    workItems: TodayWorkItem[];
    stations: TodayStationSnapshot[];
    billing: TodayBillingAttention;
    recentActivity: TodayTransaction[];
}

export type TodayPayload = TodayStaffPayload | TodayAdminPayload;
