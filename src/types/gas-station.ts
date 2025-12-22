// Gas Station Types
// Extracted from gas-station/[id]/page.tsx to reduce duplication and improve type safety

export interface DailyRecord {
    id: string;
    date: string;
    gasPrice: number;
    status: string;
    meters: MeterReading[];
    shifts?: Shift[];
}

export interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface GasTransaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string | null;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    shiftNumber?: number;
}

export interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    ownerPhone: string | null;
    ownerGroup?: string;
}

export interface GasSupply {
    id: string;
    date: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
}

export interface GaugeReading {
    tankNumber: number;
    startPercentage: number | null;
    endPercentage: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface Shift {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED';
    staffId?: string | null;
    staffName?: string;
    openingStock?: number | null;
    closingStock?: number | null;
    carryOverFromShiftId?: string | null;
    createdAt: string;
    closedAt?: string | null;
    meters?: MeterReading[];
}

export interface ProductInventoryItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        unit: string;
        salePrice: number;
    };
    quantity: number;
    alertLevel: number | null;
}

export interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
    costPrice?: number | null;
}

// API Response Types
export interface DailyDataResponse {
    station: {
        id: string;
        name: string;
        gasPrice: number;
    };
    dailyRecord: DailyRecord | null;
    currentShift: Shift | null;
    transactions: GasTransaction[];
    gasSupplies: GasSupply[];
    gaugeReadings: GaugeReading[];
    currentStock: number;
    shiftFilter: number | null;
}

export interface ShiftDataResponse {
    date: string;
    shifts: Shift[];
    openShift: Shift | null;
}
