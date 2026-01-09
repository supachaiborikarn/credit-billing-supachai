/**
 * Gas Control Center Types
 * Types for Admin Gas Station Management
 */

// ========== Shift Types ==========

export interface ShiftWithDetails {
    id: string;
    shiftNumber: number;
    shiftName: string;
    staffId: string | null;
    staffName: string;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    openingStock: number | null;
    closingStock: number | null;
    createdAt: string;
    closedAt: string | null;
    lockedAt: string | null;
    meters: MeterReading[];
    transactions: TransactionSummary[];
    reconciliation: ShiftReconciliation | null;
}

export interface MeterReading {
    id: string;
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    soldQty: number | null;
    startPhoto: string | null;
    endPhoto: string | null;
    capturedBy: string | null;
    capturedAt: string | null;
    note: string | null;
}

export interface TransactionSummary {
    id: string;
    date: string;
    licensePlate: string | null;
    ownerName: string | null;
    paymentType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    productType: string | null;
    isVoided: boolean;
    recordedByName: string;
}

export interface ShiftReconciliation {
    id: string;
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    totalExpected: number;
    totalReceived: number;
    cashReceived: number;
    creditReceived: number;
    transferReceived: number;
    variance: number;
    varianceStatus: 'GREEN' | 'YELLOW' | 'RED';
}

// ========== Dashboard Types ==========

export interface GasControlDashboard {
    stationId: string;
    stationName: string;
    date: string;

    // KPIs
    todaySales: number;
    todayTransactions: number;
    todayLiters: number;
    gaugeLevel: number | null; // Percentage

    // Shift Status
    shiftsToday: ShiftStatus[];

    // Alerts
    alerts: Alert[];

    // Trends
    salesTrend7Days: DailySalesSummary[];
}

export interface ShiftStatus {
    id: string;
    shiftNumber: number;
    shiftName: string;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    staffName: string;
    totalSales: number;
}

export interface Alert {
    id: string;
    type: 'METER_VARIANCE' | 'SHIFT_NOT_CLOSED' | 'LOW_GAUGE' | 'ANOMALY';
    severity: 'WARNING' | 'CRITICAL';
    message: string;
    shiftId?: string;
    createdAt: string;
}

export interface DailySalesSummary {
    date: string;
    totalSales: number;
    totalLiters: number;
    transactionCount: number;
}

// ========== Report Types ==========

export type ReportType = 'shift-summary' | 'daily' | 'weekly' | 'staff-performance';

export interface ReportRequest {
    type: ReportType;
    stationId: string;
    startDate: string;
    endDate: string;
    staffId?: string;
}

export interface ShiftSummaryReport {
    stationName: string;
    date: string;
    shifts: {
        shiftNumber: number;
        shiftName: string;
        staffName: string;
        openTime: string;
        closeTime: string | null;
        totalSales: number;
        cashSales: number;
        creditSales: number;
        transferSales: number;
        meterLiters: number;
        transactionLiters: number;
        variance: number;
        transactionCount: number;
    }[];
    totals: {
        totalSales: number;
        totalLiters: number;
        totalTransactions: number;
    };
}

export interface DailyReport {
    stationName: string;
    startDate: string;
    endDate: string;
    days: {
        date: string;
        totalSales: number;
        totalLiters: number;
        transactionCount: number;
        shiftCount: number;
    }[];
    totals: {
        totalSales: number;
        totalLiters: number;
        totalTransactions: number;
        averageDailySales: number;
    };
}

export interface StaffPerformanceReport {
    stationName: string;
    startDate: string;
    endDate: string;
    staff: {
        staffId: string;
        staffName: string;
        shiftsWorked: number;
        totalSales: number;
        averageSalesPerShift: number;
        transactionCount: number;
    }[];
}

// ========== Meter Edit Types ==========

export interface MeterEditRequest {
    shiftId: string;
    nozzleNumber: number;
    field: 'startReading' | 'endReading';
    newValue: number;
    reason: string;
}

export interface MeterAuditLog {
    id: string;
    meterId: string;
    field: string;
    oldValue: number;
    newValue: number;
    reason: string;
    editedBy: string;
    editedAt: string;
}

// ========== API Response Types ==========

export interface GasControlAPIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ========== Tab Types ==========

export type GasControlTab = 'dashboard' | 'shifts' | 'meters' | 'transactions' | 'reports';

export const GAS_CONTROL_TABS: { id: GasControlTab; name: string; icon: string }[] = [
    { id: 'dashboard', name: 'ภาพรวม', icon: 'LayoutDashboard' },
    { id: 'shifts', name: 'จัดการกะ', icon: 'Clock' },
    { id: 'meters', name: 'มิเตอร์', icon: 'Gauge' },
    { id: 'transactions', name: 'รายการขาย', icon: 'Receipt' },
    { id: 'reports', name: 'รายงาน', icon: 'FileText' },
];

// Gas Station Constants
export const GAS_STATIONS = [
    { id: 'station-5', stationNumber: 5, name: 'ปั๊มแก๊สพงษ์อนันต์' },
    { id: 'station-6', stationNumber: 6, name: 'ปั๊มแก๊สศุภชัย' },
] as const;

export type GasStationId = typeof GAS_STATIONS[number]['id'];
