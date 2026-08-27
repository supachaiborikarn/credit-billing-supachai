import type { NormalizedBillingDocument } from '@/lib/billing/adapter';
import type {
    Customer360BillingDocument,
    Customer360CreditContext,
    Customer360PaymentEvent,
} from '@/types/customer';

const CREDIT_TOLERANCE = 0.01;

export function toCustomerBillingDocument(
    document: NormalizedBillingDocument
): Customer360BillingDocument {
    return {
        id: document.id,
        kind: document.kind,
        number: document.number,
        totalAmount: document.totalAmount,
        paidAmount: document.paidAmount,
        remainingAmount: document.remainingAmount,
        dueDate: document.dueDate,
        createdAt: document.createdAt,
        overdue: document.overdue,
        stage: document.stage,
        sourceItemCount: document.sourceItemCount,
        pendingPaymentReviews: document.attention.pendingPaymentReviews,
        rejectedPaymentEvidence: document.attention.rejectedPaymentEvidence,
        dataQualityFlags: document.dataQualityFlags,
    };
}

export function buildCustomerPaymentHistory(
    documents: NormalizedBillingDocument[]
): Customer360PaymentEvent[] {
    return documents
        .flatMap((document) => document.paymentEvents.map((payment) => ({
            id: payment.id,
            documentId: document.id,
            documentKind: document.kind,
            documentNumber: document.number,
            source: payment.source,
            amount: payment.amount,
            status: payment.status,
            occurredAt: payment.occurredAt,
            method: payment.method,
            evidenceUrl: payment.evidenceUrl,
            notes: payment.notes,
        })))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function buildCustomerCreditContext(args: {
    creditLimit: number;
    legacyCurrentCredit: number;
    unbilledTransactionCount: number;
    unbilledAmount: number;
    documents: NormalizedBillingDocument[];
}): Customer360CreditContext {
    const invoiceDocuments = args.documents.filter((document) => document.kind === 'INVOICE');
    const collectionDocuments = args.documents.filter((document) => document.kind === 'BILLING_COLLECTION');

    const invoiceOutstanding = invoiceDocuments.reduce(
        (sum, document) => sum + document.remainingAmount,
        0
    );
    const collectionOutstanding = collectionDocuments.reduce(
        (sum, document) => sum + document.remainingAmount,
        0
    );
    const overdueDocuments = args.documents.filter((document) => document.overdue).length;
    const pendingPaymentReviews = args.documents.reduce(
        (sum, document) => sum + document.attention.pendingPaymentReviews,
        0
    );

    const safeLimit = Number.isFinite(args.creditLimit) ? Math.max(0, args.creditLimit) : 0;
    const safeLegacyCurrent = Number.isFinite(args.legacyCurrentCredit)
        ? Math.max(0, args.legacyCurrentCredit)
        : 0;

    return {
        creditLimit: safeLimit,
        legacyCurrentCredit: safeLegacyCurrent,
        legacyAvailableCredit: Math.max(0, safeLimit - safeLegacyCurrent),
        unbilledCredit: {
            transactionCount: Math.max(0, args.unbilledTransactionCount),
            amount: Math.max(0, args.unbilledAmount),
        },
        invoiceOutstanding: {
            documentCount: invoiceDocuments.filter((document) => document.remainingAmount > CREDIT_TOLERANCE).length,
            amount: invoiceOutstanding,
        },
        collectionOutstanding: {
            documentCount: collectionDocuments.filter((document) => document.remainingAmount > CREDIT_TOLERANCE).length,
            amount: collectionOutstanding,
        },
        overdueDocuments,
        pendingPaymentReviews,
        combinedOutstandingSuppressed: true,
        legacyCreditIsAuthoritative: false,
    };
}
