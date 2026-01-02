/**
 * Transaction Types
 * Shared type definitions for transaction-related API operations
 */

import { PaymentType } from '@prisma/client';

/**
 * Input for creating a new transaction via API
 * (Named APITransactionInput to avoid conflict with station.ts TransactionInput)
 */
export interface APITransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    paymentType: PaymentType;
    nozzleNumber?: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    productType?: string;
    fuelType?: string;
    transferProofUrl?: string;
    products?: ProductItem[];
}

/**
 * Product item for transaction
 */
export interface ProductItem {
    productId: string;
    qty: number;
}

/**
 * Formatted transaction response for API
 */
export interface TransactionResponse {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode: string | null;
    paymentType: PaymentType;
    fuelType: string | null;
    liters: number;
    pricePerLiter: number;
    amount: number;
    bookNo: string;
    billNo: string;
    recordedByName: string;
}

/**
 * Bulk transaction input for BillEntryForm
 */
export interface BulkTransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string;
    paymentType: PaymentType;
    billBookNo?: string;
    billNo?: string;
    transferProofUrl?: string;
    lines: FuelLine[];
}

/**
 * Fuel line for bulk transactions
 */
export interface FuelLine {
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
}

/**
 * Duplicate check parameters
 */
export interface DuplicateCheckParams {
    stationId: string;
    dateStr: string;
    licensePlate?: string;
    amount: number;
    paymentType: PaymentType;
    billBookNo?: string;
    billNo?: string;
}

/**
 * Duplicate check result
 */
export interface DuplicateCheckResult {
    isDuplicate: boolean;
    message?: string;
}
