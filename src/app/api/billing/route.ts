import { NextResponse } from 'next/server';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { requireApiSession } from '@/lib/api-auth';
import {
    normalizeCollectionBillingDocument,
    normalizeInvoiceBillingDocument,
    type NormalizedBillingDocument,
} from '@/lib/billing/adapter';
import { getBillingExceptions } from '@/lib/billing/exceptions';
import { prisma } from '@/lib/prisma';
import type {
    BillingWorkspaceItem,
    BillingWorkspacePayload,
} from '@/types/billing';

function getDocumentHref(document: NormalizedBillingDocument): string {
    return `/billing/${document.id}?kind=${document.kind}`;
}

function getDocumentNextAction(document: NormalizedBillingDocument): string {
    if (document.dataQualityFlags.length > 0) return 'ตรวจข้อมูล';
    if (document.attention.pendingPaymentReviews > 0) return 'ตรวจสลิป';
    if (document.stage === 'CLOSED') return 'ดูรายละเอียด';
    if (document.overdue) return 'ติดตามยอดค้าง';
    if (document.stage === 'PARTIAL') return 'รับชำระต่อ';
    return document.kind === 'INVOICE' ? 'บันทึกรับเงิน' : 'รับ/ตรวจสลิป';
}

function toWorkspaceDocument(document: NormalizedBillingDocument): BillingWorkspaceItem {
    return {
        id: `${document.kind}:${document.id}`,
        kind: document.kind,
        documentId: document.id,
        number: document.number,
        owner: document.owner,
        stage: document.stage,
        totalAmount: document.totalAmount,
        paidAmount: document.paidAmount,
        remainingAmount: document.remainingAmount,
        dueDate: document.dueDate,
        createdAt: document.createdAt,
        overdue: document.overdue,
        sourceItemCount: document.sourceItemCount,
        rawStatus: document.rawStatus,
        pendingPaymentReviews: document.attention.pendingPaymentReviews,
        rejectedPaymentEvidence: document.attention.rejectedPaymentEvidence,
        dataQualityFlags: document.dataQualityFlags,
        exceptions: getBillingExceptions(document),
        nextAction: {
            label: getDocumentNextAction(document),
            href: getDocumentHref(document),
        },
    };
}

export async function GET() {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const pendingPaymentTypes = [...CREDIT_PAYMENT_TYPES];
        const [pendingOwners, invoices, collections] = await Promise.all([
            prisma.owner.findMany({
                where: {
                    deletedAt: null,
                    transactions: {
                        some: {
                            paymentType: { in: pendingPaymentTypes },
                            invoiceId: null,
                            deletedAt: null,
                            isVoided: false,
                        },
                    },
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    transactions: {
                        where: {
                            paymentType: { in: pendingPaymentTypes },
                            invoiceId: null,
                            deletedAt: null,
                            isVoided: false,
                        },
                        select: { amount: true },
                    },
                },
            }),
            prisma.invoice.findMany({
                include: {
                    owner: { select: { id: true, name: true, code: true } },
                    _count: { select: { transactions: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.billingCollection.findMany({
                include: {
                    owner: { select: { id: true, name: true, code: true } },
                    _count: { select: { items: true, paymentSlips: true } },
                    paymentSlips: {
                        select: {
                            id: true,
                            amount: true,
                            transferDate: true,
                            createdAt: true,
                            slipImageUrl: true,
                            status: true,
                            bankName: true,
                            notes: true,
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const now = new Date();
        const waitingItems: BillingWorkspaceItem[] = pendingOwners
            .map((owner) => {
                const totalAmount = owner.transactions.reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0
                );
                return {
                    id: `UNBILLED:${owner.id}`,
                    kind: 'UNBILLED' as const,
                    documentId: null,
                    number: null,
                    owner: {
                        id: owner.id,
                        name: owner.name,
                        code: owner.code,
                    },
                    stage: 'WAITING_TO_BILL' as const,
                    totalAmount,
                    paidAmount: 0,
                    remainingAmount: totalAmount,
                    dueDate: null,
                    createdAt: null,
                    overdue: false,
                    sourceItemCount: owner.transactions.length,
                    rawStatus: null,
                    pendingPaymentReviews: 0,
                    rejectedPaymentEvidence: 0,
                    dataQualityFlags: [],
                    exceptions: [],
                    nextAction: {
                        label: 'เตรียมใบวางบิล',
                        href: '/invoices',
                    },
                };
            })
            .filter((item) => item.totalAmount > 0)
            .sort((a, b) => b.totalAmount - a.totalAmount);

        const invoiceDocuments = invoices.map((invoice) => normalizeInvoiceBillingDocument(invoice, now));
        const collectionDocuments = collections.map((collection) => normalizeCollectionBillingDocument(collection, now));
        const documentItems = [...invoiceDocuments, ...collectionDocuments]
            .map(toWorkspaceDocument)
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        const invoiceOutstanding = invoiceDocuments.filter((document) => document.stage !== 'CLOSED');
        const collectionOutstanding = collectionDocuments.filter((document) => document.stage !== 'CLOSED');

        const payload: BillingWorkspacePayload = {
            generatedAt: now.toISOString(),
            user: {
                id: auth.user.id,
                name: auth.user.name,
                role: auth.user.role,
            },
            items: [...waitingItems, ...documentItems],
            summary: {
                waitingToBill: {
                    ownerCount: waitingItems.length,
                    transactionCount: waitingItems.reduce((sum, item) => sum + item.sourceItemCount, 0),
                    amount: waitingItems.reduce((sum, item) => sum + item.totalAmount, 0),
                },
                invoiceOutstanding: {
                    documentCount: invoiceOutstanding.length,
                    amount: invoiceOutstanding.reduce((sum, document) => sum + document.remainingAmount, 0),
                },
                collectionOutstanding: {
                    documentCount: collectionOutstanding.length,
                    amount: collectionOutstanding.reduce((sum, document) => sum + document.remainingAmount, 0),
                },
                pendingPaymentSlips: collectionDocuments.reduce(
                    (sum, document) => sum + document.attention.pendingPaymentReviews,
                    0
                ),
            },
            workflow: {
                unsupportedPersistedStages: ['PREPARING_DOCUMENTS', 'BILLED'],
                combinedOutstandingSuppressed: true,
            },
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Billing workspace GET error:', error);
        return NextResponse.json({ error: 'โหลด Billing workspace ไม่สำเร็จ' }, { status: 500 });
    }
}
