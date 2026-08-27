import type { BillingDataQualityFlag, BillingDocumentKind, BillingPaymentEventStatus } from '@/lib/billing/adapter';

export interface Customer360Truck {
    id: string;
    licensePlate: string;
    code: string | null;
    transactionCount: number;
    lastTransactionAt: string | null;
}

export interface Customer360Transaction {
    id: string;
    stationId: string;
    stationName: string;
    stationType: string;
    date: string;
    licensePlate: string | null;
    truckId: string | null;
    paymentType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo: string | null;
    billNo: string | null;
    invoiceId: string | null;
}

export interface Customer360BillingDocument {
    id: string;
    kind: BillingDocumentKind;
    number: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string | null;
    createdAt: string;
    overdue: boolean;
    stage: 'AWAITING_PAYMENT' | 'PARTIAL' | 'CLOSED';
    sourceItemCount: number;
    pendingPaymentReviews: number;
    rejectedPaymentEvidence: number;
    dataQualityFlags: BillingDataQualityFlag[];
}

export interface Customer360PaymentEvent {
    id: string;
    documentId: string;
    documentKind: BillingDocumentKind;
    documentNumber: string;
    source: 'PAYMENT' | 'PAYMENT_SLIP';
    amount: number;
    status: BillingPaymentEventStatus;
    occurredAt: string;
    method: string | null;
    evidenceUrl: string | null;
    notes: string | null;
}

export interface Customer360CreditContext {
    creditLimit: number;
    legacyCurrentCredit: number;
    legacyAvailableCredit: number;
    unbilledCredit: {
        transactionCount: number;
        amount: number;
    };
    invoiceOutstanding: {
        documentCount: number;
        amount: number;
    };
    collectionOutstanding: {
        documentCount: number;
        amount: number;
    };
    overdueDocuments: number;
    pendingPaymentReviews: number;
    combinedOutstandingSuppressed: true;
    legacyCreditIsAuthoritative: false;
}

export interface Customer360Payload {
    generatedAt: string;
    customer: {
        id: string;
        name: string;
        code: string | null;
        venderCode: string | null;
        phone: string | null;
        groupType: string;
        status: string;
        createdAt: string;
    };
    trucks: Customer360Truck[];
    recentTransactions: Customer360Transaction[];
    billingDocuments: Customer360BillingDocument[];
    paymentHistory: Customer360PaymentEvent[];
    credit: Customer360CreditContext;
    counts: {
        trucks: number;
        activeTransactions: number;
        invoices: number;
        billingCollections: number;
    };
    permissions: {
        canEditCustomer: boolean;
        canManageCreditLimit: boolean;
    };
    workflow: {
        transactionHistoryLimit: number;
        combinedOutstandingSuppressed: true;
        creditSourceNote: string;
    };
}

export type CustomerAttentionLevel = 'NONE' | 'INFO' | 'WARNING' | 'CRITICAL';

export interface CustomerListItem {
    id: string;
    name: string;
    code: string | null;
    phone: string | null;
    groupType: string;
    status: string;
    truckCount: number;
    transactionCount: number;
    creditLimit: number;
    legacyCurrentCredit: number;
    outstanding: {
        unbilledAmount: number;
        unbilledTransactionCount: number;
        invoiceAmount: number;
        invoiceDocumentCount: number;
        collectionAmount: number;
        collectionDocumentCount: number;
        combinedOutstandingSuppressed: true;
    };
    attention: {
        level: CustomerAttentionLevel;
        overdueDocuments: number;
        pendingPaymentReviews: number;
        legacyOverLimit: boolean;
        inactive: boolean;
        labels: string[];
    };
    nextAction: {
        label: string;
        href: string;
    };
}

export interface CustomerListPayload {
    generatedAt: string;
    items: CustomerListItem[];
    summary: {
        customerCount: number;
        attentionCount: number;
        unbilledAmount: number;
        invoiceOutstandingAmount: number;
        collectionOutstandingAmount: number;
    };
    workflow: {
        combinedOutstandingSuppressed: true;
        legacyCreditIsAuthoritative: false;
    };
}
