import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/api-auth';
import {
    normalizeCollectionBillingDocument,
    normalizeInvoiceBillingDocument,
    type NormalizedBillingDocument,
} from '@/lib/billing/adapter';
import { getBillingExceptions } from '@/lib/billing/exceptions';
import { prisma } from '@/lib/prisma';
import type {
    BillingDetailPayload,
    BillingDetailSourceItem,
    BillingWorkspaceItem,
} from '@/types/billing';

function toWorkspaceDocument(
    document: NormalizedBillingDocument,
    legacyHref: string
): BillingWorkspaceItem {
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
            label: document.stage === 'CLOSED' ? 'ดูหน้าเดิม' : 'จัดการรับชำระ',
            href: legacyHref,
        },
    };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;
        const kind = new URL(request.url).searchParams.get('kind');
        const now = new Date();

        if (kind === 'INVOICE') {
            const invoice = await prisma.invoice.findUnique({
                where: { id },
                include: {
                    owner: {
                        select: { id: true, name: true, code: true, phone: true },
                    },
                    transactions: {
                        orderBy: { date: 'asc' },
                        select: {
                            id: true,
                            date: true,
                            stationId: true,
                            licensePlate: true,
                            liters: true,
                            pricePerLiter: true,
                            amount: true,
                            paymentType: true,
                            billBookNo: true,
                            billNo: true,
                            productType: true,
                            station: { select: { name: true } },
                        },
                    },
                    payments: { orderBy: { paymentDate: 'desc' } },
                },
            });

            if (!invoice) {
                return NextResponse.json({ error: 'ไม่พบ Invoice' }, { status: 404 });
            }

            const normalized = normalizeInvoiceBillingDocument(invoice, now);
            const sourceItems: BillingDetailSourceItem[] = invoice.transactions.map((transaction) => ({
                id: transaction.id,
                date: transaction.date.toISOString(),
                description: transaction.productType || 'รายการขายเชื่อ',
                station: transaction.station?.name || transaction.stationId,
                reference: transaction.billBookNo || transaction.billNo
                    ? [transaction.billBookNo, transaction.billNo].filter(Boolean).join('/')
                    : transaction.licensePlate || null,
                amount: Number(transaction.amount),
                quantityText: Number(transaction.liters) > 0
                    ? `${Number(transaction.liters).toLocaleString('th-TH', { maximumFractionDigits: 3 })} ลิตร`
                    : null,
            }));

            const legacyHref = `/invoices/${id}`;
            const payload: BillingDetailPayload = {
                document: toWorkspaceDocument(normalized, legacyHref),
                customer: {
                    id: invoice.owner.id,
                    name: invoice.owner.name,
                    code: invoice.owner.code,
                    phone: invoice.owner.phone,
                },
                sourceItems,
                paymentEvents: normalized.paymentEvents,
                legacyAction: {
                    label: normalized.stage === 'CLOSED' ? 'เปิดหน้า Invoice เดิม' : 'จัดการรับชำระในหน้าเดิม',
                    href: legacyHref,
                },
                permissions: {
                    canReceivePayment: auth.user.role === 'ADMIN',
                },
            };

            return NextResponse.json(payload);
        }

        if (kind === 'BILLING_COLLECTION') {
            const collection = await prisma.billingCollection.findUnique({
                where: { id },
                include: {
                    owner: {
                        select: { id: true, name: true, code: true, phone: true },
                    },
                    items: { orderBy: { createdAt: 'asc' } },
                    paymentSlips: { orderBy: { createdAt: 'desc' } },
                },
            });

            if (!collection) {
                return NextResponse.json({ error: 'ไม่พบใบวางบิลรวม' }, { status: 404 });
            }

            const normalized = normalizeCollectionBillingDocument(collection, now);
            const sourceItems: BillingDetailSourceItem[] = collection.items.map((item) => ({
                id: item.id,
                date: item.createdAt.toISOString(),
                description: item.sourceDescription,
                station: item.sourceStation,
                reference: item.sourceInvoiceNo,
                amount: Number(item.amount),
                quantityText: null,
            }));

            const legacyHref = `/billing-collections/${id}`;
            const payload: BillingDetailPayload = {
                document: toWorkspaceDocument(normalized, legacyHref),
                customer: {
                    id: collection.owner.id,
                    name: collection.owner.name,
                    code: collection.owner.code,
                    phone: collection.owner.phone,
                },
                sourceItems,
                paymentEvents: normalized.paymentEvents,
                legacyAction: {
                    label: normalized.stage === 'CLOSED' ? 'เปิดหน้าใบวางบิลรวมเดิม' : 'จัดการสลิปในหน้าเดิม',
                    href: legacyHref,
                },
                permissions: {
                    canReceivePayment: auth.user.role === 'ADMIN',
                },
            };

            return NextResponse.json(payload);
        }

        return NextResponse.json(
            { error: 'ต้องระบุ kind=INVOICE หรือ BILLING_COLLECTION' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Billing detail GET error:', error);
        return NextResponse.json({ error: 'โหลดรายละเอียด Billing ไม่สำเร็จ' }, { status: 500 });
    }
}
