import type { BillingWorkspaceSummary } from '@/types/billing';
import {
    deriveBillingSettlementStage,
    getBillingRemainingAmount,
} from './lifecycle';

type NumericLike = number | string | null | undefined | { toString(): string };

export interface BillingOutstandingOwnerSource {
    transactions: Array<{ amount: NumericLike }>;
}

export interface BillingOutstandingDocumentSource {
    totalAmount: NumericLike;
    paidAmount: NumericLike;
}

export type BillingOutstandingBuckets = Pick<
    BillingWorkspaceSummary,
    'waitingToBill' | 'invoiceOutstanding' | 'collectionOutstanding'
>;

function toNumber(value: NumericLike): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeDocuments(documents: BillingOutstandingDocumentSource[]) {
    const openDocuments = documents
        .map((document) => {
            const totalAmount = toNumber(document.totalAmount);
            const paidAmount = toNumber(document.paidAmount);
            const stage = deriveBillingSettlementStage({ totalAmount, paidAmount });
            return {
                stage,
                remainingAmount: getBillingRemainingAmount({ totalAmount, paidAmount }),
            };
        })
        .filter((document) => document.stage !== 'CLOSED');

    return {
        documentCount: openDocuments.length,
        amount: openDocuments.reduce((sum, document) => sum + document.remainingAmount, 0),
    };
}

export function buildBillingOutstandingSummary(input: {
    pendingOwners: BillingOutstandingOwnerSource[];
    invoices: BillingOutstandingDocumentSource[];
    collections: BillingOutstandingDocumentSource[];
}): BillingOutstandingBuckets {
    const waitingOwners = input.pendingOwners
        .map((owner) => {
            const amount = owner.transactions.reduce(
                (sum, transaction) => sum + toNumber(transaction.amount),
                0
            );
            return { amount, transactionCount: owner.transactions.length };
        })
        .filter((owner) => owner.amount > 0);

    return {
        waitingToBill: {
            ownerCount: waitingOwners.length,
            transactionCount: waitingOwners.reduce((sum, owner) => sum + owner.transactionCount, 0),
            amount: waitingOwners.reduce((sum, owner) => sum + owner.amount, 0),
        },
        invoiceOutstanding: summarizeDocuments(input.invoices),
        collectionOutstanding: summarizeDocuments(input.collections),
    };
}
