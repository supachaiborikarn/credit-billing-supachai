export type ActiveSaleStationId = 'station-1' | 'station-5' | 'station-6';
export type RetiredSaleStationId = 'station-2' | 'station-3' | 'station-4';
export type SaleStationType = 'FULL' | 'GAS';

export type SaleFlowPaymentType =
    | 'CASH'
    | 'CREDIT'
    | 'TRANSFER'
    | 'BOX_TRUCK'
    | 'OIL_TRUCK_SUPACHAI'
    | 'CREDIT_CARD';

export type SaleEntryMode = 'LITERS' | 'AMOUNT';
export type SaleBusinessDateMode = 'BANGKOK_CALENDAR_DAY' | 'GAS_07_BUSINESS_DAY';
export type SalePriceSource = 'FULL_DAILY_RETAIL_WHOLESALE' | 'GAS_DAILY_PRICE';
export type TransferEvidenceRule = 'REQUIRED' | 'OPTIONAL';
export type SupplementalProductMode = 'NONE' | 'SEPARATE_STOCK_FLOW';
export type TruckSelectionMode = 'EXISTING_ONLY' | 'ALLOW_NEW_PLATE_FOR_OWNER';

export interface SaleFlowCapabilities {
    stationId: ActiveSaleStationId;
    stationType: SaleStationType;
    entryMode: SaleEntryMode;
    businessDateMode: SaleBusinessDateMode;
    priceSource: SalePriceSource;
    requiresNozzle: boolean;
    allowedPaymentTypes: readonly SaleFlowPaymentType[];
    creditLikePaymentTypes: readonly SaleFlowPaymentType[];
    transferEvidence: TransferEvidenceRule;
    supplementalProducts: SupplementalProductMode;
    truckSelection: TruckSelectionMode;
}

export const SALE_FLOW_CAPABILITIES: Record<ActiveSaleStationId, SaleFlowCapabilities> = {
    'station-1': {
        stationId: 'station-1',
        stationType: 'FULL',
        entryMode: 'LITERS',
        businessDateMode: 'BANGKOK_CALENDAR_DAY',
        priceSource: 'FULL_DAILY_RETAIL_WHOLESALE',
        requiresNozzle: true,
        allowedPaymentTypes: [
            'CASH',
            'CREDIT',
            'TRANSFER',
            'BOX_TRUCK',
            'OIL_TRUCK_SUPACHAI',
            'CREDIT_CARD',
        ],
        creditLikePaymentTypes: ['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'],
        transferEvidence: 'REQUIRED',
        supplementalProducts: 'NONE',
        truckSelection: 'ALLOW_NEW_PLATE_FOR_OWNER',
    },
    'station-5': {
        stationId: 'station-5',
        stationType: 'GAS',
        entryMode: 'AMOUNT',
        businessDateMode: 'GAS_07_BUSINESS_DAY',
        priceSource: 'GAS_DAILY_PRICE',
        requiresNozzle: false,
        allowedPaymentTypes: ['CASH', 'CREDIT', 'CREDIT_CARD', 'TRANSFER'],
        creditLikePaymentTypes: ['CREDIT'],
        transferEvidence: 'OPTIONAL',
        supplementalProducts: 'SEPARATE_STOCK_FLOW',
        truckSelection: 'EXISTING_ONLY',
    },
    'station-6': {
        stationId: 'station-6',
        stationType: 'GAS',
        entryMode: 'AMOUNT',
        businessDateMode: 'GAS_07_BUSINESS_DAY',
        priceSource: 'GAS_DAILY_PRICE',
        requiresNozzle: false,
        allowedPaymentTypes: ['CASH', 'CREDIT', 'CREDIT_CARD', 'TRANSFER'],
        creditLikePaymentTypes: ['CREDIT'],
        transferEvidence: 'OPTIONAL',
        supplementalProducts: 'NONE',
        truckSelection: 'EXISTING_ONLY',
    },
};

export interface SaleFlowStationContext {
    stationId: ActiveSaleStationId;
    stationName: string;
    stationType: SaleStationType;
    stationNumber: number;
    businessDate: string;
    shiftId: string;
    shiftNumber?: number;
}

export interface SaleFlowCustomerSelection {
    ownerId: string | null;
    ownerName: string;
    ownerCode?: string | null;
    truckId: string | null;
    licensePlate: string;
}

export interface SaleFlowFuelSelection {
    kind: 'FUEL';
    productType: 'DIESEL' | 'LPG';
    nozzleNumber: number | null;
    liters: number | null;
    pricePerLiter: number | null;
    amount: number | null;
}

export interface SaleFlowPaymentSelection {
    type: SaleFlowPaymentType;
    billBookNo: string;
    billNo: string;
    notes: string;
}

export interface SaleFlowEvidence {
    transferProofUrl: string | null;
}

export interface SaleFlowDraft {
    station: SaleFlowStationContext;
    customer: SaleFlowCustomerSelection;
    item: SaleFlowFuelSelection;
    payment: SaleFlowPaymentSelection;
    evidence: SaleFlowEvidence;
}

export interface SaleFlowComputedRequirements {
    requiresCustomer: boolean;
    requiresTruck: boolean;
    requiresBill: boolean;
    requiresTransferProof: boolean;
    showCustomerStep: boolean;
    showNozzle: boolean;
}

export function isActiveSaleStationId(stationId: string): stationId is ActiveSaleStationId {
    return stationId in SALE_FLOW_CAPABILITIES;
}

export function isRetiredSaleStationId(stationId: string): stationId is RetiredSaleStationId {
    return stationId === 'station-2' || stationId === 'station-3' || stationId === 'station-4';
}

export function getSaleFlowCapabilities(stationId: string): SaleFlowCapabilities | null {
    if (!isActiveSaleStationId(stationId)) return null;
    return SALE_FLOW_CAPABILITIES[stationId];
}

export function getSaleFlowLegacyRouteId(stationId: ActiveSaleStationId): string {
    return stationId.replace('station-', '');
}

export function getSaleFlowRequirements(
    capabilities: SaleFlowCapabilities,
    paymentType: SaleFlowPaymentType
): SaleFlowComputedRequirements {
    const isCreditLike = capabilities.creditLikePaymentTypes.includes(paymentType);
    const isTransfer = paymentType === 'TRANSFER';

    return {
        requiresCustomer: isCreditLike,
        requiresTruck: isCreditLike,
        requiresBill: isCreditLike,
        requiresTransferProof: isTransfer && capabilities.transferEvidence === 'REQUIRED',
        showCustomerStep: isCreditLike,
        showNozzle: capabilities.requiresNozzle,
    };
}

export function createEmptySaleDraft(
    station: SaleFlowStationContext,
    defaultPaymentType: SaleFlowPaymentType = 'CASH'
): SaleFlowDraft {
    const capabilities = getSaleFlowCapabilities(station.stationId);
    const safePaymentType = capabilities?.allowedPaymentTypes.includes(defaultPaymentType)
        ? defaultPaymentType
        : capabilities?.allowedPaymentTypes[0] || 'CASH';

    return {
        station,
        customer: {
            ownerId: null,
            ownerName: '',
            ownerCode: null,
            truckId: null,
            licensePlate: '',
        },
        item: {
            kind: 'FUEL',
            productType: station.stationType === 'GAS' ? 'LPG' : 'DIESEL',
            nozzleNumber: capabilities?.requiresNozzle ? 1 : null,
            liters: null,
            pricePerLiter: null,
            amount: null,
        },
        payment: {
            type: safePaymentType,
            billBookNo: '',
            billNo: '',
            notes: '',
        },
        evidence: {
            transferProofUrl: null,
        },
    };
}
