import {
    BILLING_SETTLEMENT_TOLERANCE,
    deriveBillingSettlementStage,
    getBillingRemainingAmount,
    isBillingOverdue,
    type BillingPipelineStage,
} from './lifecycle';

export type BillingDocumentKind = 'INVOICE' | 'BILLING_COLLECTION';
export type BillingPaymentEventSource = 'PAYMENT' | 'PAYMENT_SLIP';
export type BillingPaymentEventStatus = 'CONFIRMED' | 'PENDING_REVIEW' | 'REJECTED';
export type BillingDataQualityFlag =
    | 'PAID_AMOUNT_MISMATCH'
    | 'STATUS_AMOUNT_MISMATCH'
    | 'OVERPAID_AMOUNT'
    | 'MISSING_SOURCE_ITEMS';

export interface BillingOwnerSummary {
    id: string;
    name: string;
    code: string | null;
}

export interface BillingPaymentEvent {
    id: string;
    source: BillingPaymentEventSource;
    amount: number;
    status: BillingPaymentEventStatus;
    occurredAt: string;
    method: string | null;
    evidenceUrl: string | null;
    notes: string | null;
    senderName?: string | null;
}

export interface NormalizedBillingDocument {
    id: string;
    kind: BillingDocumentKind;
    number: string;
    owner: BillingOwnerSummary;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    rawStatus: string;
    stage: Extract<BillingPipelineStage, 'AWAITING_PAYMENT' | 'PARTIAL' | 'CLOSED'>;
    dueDate: string | null;
    createdAt: string;
    overdue: boolean;
    sourceItemCount: number;
    paymentEvents: BillingPaymentEvent[];
    attention: {
        overdue: boolean;
        pendingPaymentReviews: number;
        rejectedPaymentEvidence: number;
    };
    dataQualityFlags: BillingDataQualityFlag[];
}

interface NumericValue {
    toString(): string;
}

type NumericInput = number | string | NumericValue | null | undefined;
type DateInput = Date | string | null | undefined;

export interface InvoiceAdapterPaymentInput {
    id: string;
    amount: NumericInput;
    paymentDate: DateInput;
    paymentMethod: string;
    notes?: string | null;
}

export interface InvoiceAdapterInput {
    id: string;
    invoiceNumber: string;
    totalAmount: NumericInput;
    paidAmount: NumericInput;
    status: string;
    dueDate?: DateInput;
    createdAt: DateInput;
    owner: {
        id: string;
        name: string;
        code?: string | null;
    };
    payments?: InvoiceAdapterPaymentInput[];
    _count?: { transactions?: number };
    transactions?: unknown[];
}

export interface BillingCollectionSlipInput {
    id: string;
    amount: NumericInput;
    transferDate?: DateInput;
    createdAt: DateInput;
    slipImageUrl: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
    bankName?: string | null;
    notes?: string | null;
    senderName?: string | null;
}

export interface BillingCollectionAdapterInput {
    id: string;
    collectionNo: string;
    ownerId: string;
    ownerName: string;
    totalAmount: NumericInput;
    paidAmount: NumericInput;
    status: string;
    dueDate?: DateInput;
    createdAt: DateInput;
    owner?: {
        id: string;
        name: string;
        code?: string | null;
    } | null;
    paymentSlips?: BillingCollectionSlipInput[];
    _count?: { items?: number; paymentSlips?: number };
    items?: unknown[];
}

function toNumber(value: NumericInput): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value: DateInput): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getExpectedRawSettlementStatus(
    stage: NormalizedBillingDocument['stage']
): 'PENDING' | 'PARTIAL' | 'PAID' {
    if (stage === 'CLOSED') return 'PAID';
    if (stage === 'PARTIAL') return 'PARTIAL';
    return 'PENDING';
}

function deriveQualityFlags(args: {
    totalAmount: number;
    paidAmount: number;
    rawStatus: string;
    stage: NormalizedBillingDocument['stage'];
    confirmedPaymentTotal?: number;
}): BillingDataQualityFlag[] {
    const flags: BillingDataQualityFlag[] = [];

    if (args.paidAmount > args.totalAmount + BILLING_SETTLEMENT_TOLERANCE) {
        flags.push('OVERPAID_AMOUNT');
    }

    if (
        args.confirmedPaymentTotal !== undefined
        && Math.abs(args.confirmedPaymentTotal - args.paidAmount) > BILLING_SETTLEMENT_TOLERANCE
    ) {
        flags.push('PAID_AMOUNT_MISMATCH');
    }

    const expectedStatus = getExpectedRawSettlementStatus(args.stage);
    const rawSettlementStatus = args.rawStatus === 'OVERDUE' ? expectedStatus : args.rawStatus;
    if (rawSettlementStatus !== expectedStatus) {
        flags.push('STATUS_AMOUNT_MISMATCH');
    }

    return flags;
}

function normalizeInvoicePayments(payments: InvoiceAdapterPaymentInput[] | undefined): BillingPaymentEvent[] {
    if (!payments) return [];
    return payments.map((payment) => ({
        id: payment.id,
        source: 'PAYMENT' as const,
        amount: toNumber(payment.amount),
        status: 'CONFIRMED' as const,
        occurredAt: toIsoString(payment.paymentDate) || new Date(0).toISOString(),
        method: payment.paymentMethod || null,
        evidenceUrl: null,
        notes: payment.notes || null,
        senderName: null,
    }));
}

function normalizeCollectionSlips(slips: BillingCollectionSlipInput[] | undefined): BillingPaymentEvent[] {
    if (!slips) return [];
    return slips.map((slip) => ({
        id: slip.id,
        source: 'PAYMENT_SLIP' as const,
        amount: toNumber(slip.amount),
        status: slip.status === 'VERIFIED'
            ? 'CONFIRMED' as const
            : slip.status === 'REJECTED'
                ? 'REJECTED' as const
                : 'PENDING_REVIEW' as const,
        occurredAt: toIsoString(slip.transferDate) || toIsoString(slip.createdAt) || new Date(0).toISOString(),
        method: slip.bankName || 'TRANSFER',
        evidenceUrl: slip.slipImageUrl || null,
        notes: slip.notes || null,
        senderName: slip.senderName || null,
    }));
}

export function normalizeInvoiceBillingDocument(
    invoice: InvoiceAdapterInput,
    now: Date = new Date()
): NormalizedBillingDocument {
    const totalAmount = toNumber(invoice.totalAmount);
    const paidAmount = toNumber(invoice.paidAmount);
    const stage = deriveBillingSettlementStage({ totalAmount, paidAmount });
    const dueDate = toIsoString(invoice.dueDate);
    const paymentEvents = normalizeInvoicePayments(invoice.payments);
    const confirmedPaymentTotal = invoice.payments
        ? paymentEvents.reduce((sum, payment) => sum + payment.amount, 0)
        : undefined;
    const overdue = isBillingOverdue({ totalAmount, paidAmount, dueDate }, now);
    const sourceItemCount = invoice._count?.transactions ?? invoice.transactions?.length ?? 0;
    const dataQualityFlags = deriveQualityFlags({
        totalAmount,
        paidAmount,
        rawStatus: invoice.status,
        stage,
        confirmedPaymentTotal,
    });
    if (totalAmount > BILLING_SETTLEMENT_TOLERANCE && sourceItemCount === 0) {
        dataQualityFlags.push('MISSING_SOURCE_ITEMS');
    }

    return {
        id: invoice.id,
        kind: 'INVOICE',
        number: invoice.invoiceNumber,
        owner: {
            id: invoice.owner.id,
            name: invoice.owner.name,
            code: invoice.owner.code || null,
        },
        totalAmount,
        paidAmount,
        remainingAmount: getBillingRemainingAmount({ totalAmount, paidAmount }),
        rawStatus: invoice.status,
        stage,
        dueDate,
        createdAt: toIsoString(invoice.createdAt) || new Date(0).toISOString(),
        overdue,
        sourceItemCount,
        paymentEvents,
        attention: {
            overdue,
            pendingPaymentReviews: 0,
            rejectedPaymentEvidence: 0,
        },
        dataQualityFlags,
    };
}

export function normalizeCollectionBillingDocument(
    collection: BillingCollectionAdapterInput,
    now: Date = new Date()
): NormalizedBillingDocument {
    const totalAmount = toNumber(collection.totalAmount);
    const paidAmount = toNumber(collection.paidAmount);
    const stage = deriveBillingSettlementStage({ totalAmount, paidAmount });
    const dueDate = toIsoString(collection.dueDate);
    const paymentEvents = normalizeCollectionSlips(collection.paymentSlips);
    const confirmedPaymentTotal = collection.paymentSlips
        ? paymentEvents
            .filter((payment) => payment.status === 'CONFIRMED')
            .reduce((sum, payment) => sum + payment.amount, 0)
        : undefined;
    const pendingPaymentReviews = paymentEvents.filter((payment) => payment.status === 'PENDING_REVIEW').length;
    const rejectedPaymentEvidence = paymentEvents.filter((payment) => payment.status === 'REJECTED').length;
    const overdue = isBillingOverdue({ totalAmount, paidAmount, dueDate }, now);
    const sourceItemCount = collection._count?.items ?? collection.items?.length ?? 0;
    const dataQualityFlags = deriveQualityFlags({
        totalAmount,
        paidAmount,
        rawStatus: collection.status,
        stage,
        confirmedPaymentTotal,
    });
    if (totalAmount > BILLING_SETTLEMENT_TOLERANCE && sourceItemCount === 0) {
        dataQualityFlags.push('MISSING_SOURCE_ITEMS');
    }

    return {
        id: collection.id,
        kind: 'BILLING_COLLECTION',
        number: collection.collectionNo,
        owner: {
            id: collection.owner?.id || collection.ownerId,
            name: collection.owner?.name || collection.ownerName,
            code: collection.owner?.code || null,
        },
        totalAmount,
        paidAmount,
        remainingAmount: getBillingRemainingAmount({ totalAmount, paidAmount }),
        rawStatus: collection.status,
        stage,
        dueDate,
        createdAt: toIsoString(collection.createdAt) || new Date(0).toISOString(),
        overdue,
        sourceItemCount,
        paymentEvents,
        attention: {
            overdue,
            pendingPaymentReviews,
            rejectedPaymentEvidence,
        },
        dataQualityFlags,
    };
}
