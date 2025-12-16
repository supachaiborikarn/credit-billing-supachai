/**
 * Shared TypeScript interfaces for the Credit Billing application
 */

// ==================== API/Database Types ====================

export interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    ownerPhone: string | null;
    ownerGroup?: string;
}

export interface Owner {
    id: string;
    name: string;
    code: string | null;
    phone: string | null;
    groupType?: string;
}

export interface OwnerWithBalance extends Owner {
    totalCredit: number;
    transactionCount: number;
}

export interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    nozzleNumber?: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    fuelType?: string;
    productType?: string;
}

export interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
}

export interface DailyRecord {
    id: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    status: string;
    meters: MeterReading[];
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    owner: Owner;
    totalAmount: number;
    paidAmount: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID';
    dueDate: string | null;
    createdAt: string;
    _count?: { transactions: number };
}

// ==================== Component Props Types ====================

export interface FuelLine {
    id: string;
    fuelType: string;
    quantity: string;
    pricePerLiter: string;
}

// ==================== Dashboard Types ====================

export interface DashboardStats {
    totalOwners: number;
    totalTrucks: number;
    todayTransactions: number;
    todayAmount: number;
    pendingInvoices: number;
    pendingAmount: number;
    stationStats: {
        stationId: string;
        stationName: string;
        todayAmount: number;
        todayLiters: number;
    }[];
    weeklySales: {
        date: string;
        dayName: string;
        amount: number;
        liters: number;
        count: number;
    }[];
    paymentTypeStats: {
        type: string;
        label: string;
        color: string;
        amount: number;
        count: number;
    }[];
    topCustomers: {
        id: string;
        name: string;
        code: string | null;
        amount: number;
        liters: number;
        count: number;
    }[];
}
