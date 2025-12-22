// Station Types for API Routes
// Shared types for station-related API endpoints

export interface StationConfig {
    id: string;
    name: string;
    type: 'FULL' | 'SIMPLE' | 'GAS';
    hasProducts?: boolean;
    aliases?: readonly string[];
}

export interface Station {
    id: string;
    name: string;
    type: string;
    gasPrice?: number | null;
    gasStockAlert?: number | null;
    hasProducts?: boolean;
}

export interface TransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string | null;
    paymentType: string;
    nozzleNumber?: number | null;
    liters: number;
    pricePerLiter: number;
    amount: number;
    productType?: string;
    shiftNumber?: number;
    billBookNo?: string;
    billNo?: string;
    transferProofUrl?: string | null;
}

export interface MeterInput {
    nozzleNumber: number;
    reading: number;
}

export interface GaugeInput {
    tankNumber: number;
    percentage: number;
    type: 'start' | 'end';
    shiftNumber?: number;
}

export interface ShiftInput {
    shiftNumber: number;
    staffName?: string;
    meters?: { nozzleNumber: number; startReading: number }[];
}

// API Response common types
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}

export interface ApiErrorResponse {
    error: string;
    details?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
