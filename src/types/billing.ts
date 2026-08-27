import type { BillingDataQualityFlag, BillingDocumentKind, BillingPaymentEvent } from '@/lib/billing/adapter';
import type { BillingException } from '@/lib/billing/exceptions';
import type { BillingPipelineStage } from '@/lib/billing/lifecycle';

export type BillingWorkspaceItemKind = 'UNBILLED' | BillingDocumentKind;

export interface BillingWorkspaceOwner {
    id: string;
    name: string;
    code: string | null;
}

export interface BillingWorkspaceItem {
    id: string;
    kind: BillingWorkspaceItemKind;
    documentId: string | null;
    number: string | null;
    owner: BillingWorkspaceOwner;
    stage: BillingPipelineStage;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string | null;
    createdAt: string | null;
    overdue: boolean;
    sourceItemCount: number;
    rawStatus: string | null;
    pendingPaymentReviews: number;
    rejectedPaymentEvidence: number;
    dataQualityFlags: BillingDataQualityFlag[];
    exceptions: BillingException[];
    nextAction: {
        label: string;
        href: string;
    };
}

export interface BillingWorkspaceSummary {
    waitingToBill: {
        ownerCount: number;
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
    pendingPaymentSlips: number;
}

export interface BillingWorkspacePayload {
    generatedAt: string;
    user: {
        id: string;
        name: string;
        role: 'ADMIN' | 'STAFF';
    };
    items: BillingWorkspaceItem[];
    summary: BillingWorkspaceSummary;
    workflow: {
        unsupportedPersistedStages: Array<'PREPARING_DOCUMENTS' | 'BILLED'>;
        combinedOutstandingSuppressed: true;
    };
}

export interface BillingDetailSourceItem {
    id: string;
    date: string | null;
    description: string;
    station: string | null;
    reference: string | null;
    amount: number;
    quantityText: string | null;
}

export interface BillingDetailPayload {
    document: BillingWorkspaceItem;
    customer: {
        id: string;
        name: string;
        code: string | null;
        phone: string | null;
    };
    sourceItems: BillingDetailSourceItem[];
    paymentEvents: BillingPaymentEvent[];
    legacyAction: {
        label: string;
        href: string;
    };
    permissions: {
        canReceivePayment: boolean;
    };
}
