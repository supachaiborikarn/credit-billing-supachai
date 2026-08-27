import { NextRequest, NextResponse } from 'next/server';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { requireApiSession } from '@/lib/api-auth';
import { deriveCustomerAttention, getCustomerNextAction } from '@/lib/customers/customer-list';
import { prisma } from '@/lib/prisma';
import type { CustomerListPayload } from '@/types/customer';

function remainingAmount(totalAmount: unknown, paidAmount: unknown) {
    return Math.max(0, Number(totalAmount || 0) - Number(paidAmount || 0));
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const now = new Date();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'ACTIVE';
        const search = (searchParams.get('search') || '').trim();

        const owners = await prisma.owner.findMany({
            where: {
                ...(status !== 'ALL' ? { status: status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' } : {}),
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' as const } },
                            { code: { contains: search, mode: 'insensitive' as const } },
                            { phone: { contains: search, mode: 'insensitive' as const } },
                            { trucks: { some: { licensePlate: { contains: search, mode: 'insensitive' as const } } } },
                        ],
                    }
                    : {}),
            },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                code: true,
                phone: true,
                groupType: true,
                status: true,
                creditLimit: true,
                currentCredit: true,
                _count: {
                    select: {
                        trucks: { where: { deletedAt: null } },
                    },
                },
            },
        });

        const ownerIds = owners.map((owner) => owner.id);
        if (ownerIds.length === 0) {
            const empty: CustomerListPayload = {
                generatedAt: now.toISOString(),
                items: [],
                summary: {
                    customerCount: 0,
                    attentionCount: 0,
                    unbilledAmount: 0,
                    invoiceOutstandingAmount: 0,
                    collectionOutstandingAmount: 0,
                },
                workflow: {
                    combinedOutstandingSuppressed: true,
                    legacyCreditIsAuthoritative: false,
                },
            };
            return NextResponse.json(empty);
        }

        const [transactionGroups, unbilledGroups, invoices, collections, pendingSlips] = await Promise.all([
            prisma.transaction.groupBy({
                by: ['ownerId'],
                where: { ownerId: { in: ownerIds }, deletedAt: null, isVoided: false },
                _count: { _all: true },
            }),
            prisma.transaction.groupBy({
                by: ['ownerId'],
                where: {
                    ownerId: { in: ownerIds },
                    paymentType: { in: CREDIT_PAYMENT_TYPES },
                    invoiceId: null,
                    deletedAt: null,
                    isVoided: false,
                },
                _count: { _all: true },
                _sum: { amount: true },
            }),
            prisma.invoice.findMany({
                where: { ownerId: { in: ownerIds } },
                select: { ownerId: true, totalAmount: true, paidAmount: true, dueDate: true },
            }),
            prisma.billingCollection.findMany({
                where: { ownerId: { in: ownerIds } },
                select: { ownerId: true, totalAmount: true, paidAmount: true, dueDate: true },
            }),
            prisma.paymentSlip.findMany({
                where: {
                    status: 'PENDING',
                    billingCollection: { ownerId: { in: ownerIds } },
                },
                select: { billingCollection: { select: { ownerId: true } } },
            }),
        ]);

        const transactionCountMap = new Map(
            transactionGroups.filter((row) => row.ownerId).map((row) => [row.ownerId as string, row._count._all])
        );
        const unbilledMap = new Map(
            unbilledGroups.filter((row) => row.ownerId).map((row) => [
                row.ownerId as string,
                { count: row._count._all, amount: Number(row._sum.amount || 0) },
            ])
        );
        const invoiceMap = new Map<string, { count: number; amount: number; overdue: number }>();
        for (const invoice of invoices) {
            const remaining = remainingAmount(invoice.totalAmount, invoice.paidAmount);
            if (remaining <= 0.01) continue;
            const current = invoiceMap.get(invoice.ownerId) || { count: 0, amount: 0, overdue: 0 };
            current.count += 1;
            current.amount += remaining;
            if (invoice.dueDate && invoice.dueDate < now) current.overdue += 1;
            invoiceMap.set(invoice.ownerId, current);
        }

        const collectionMap = new Map<string, { count: number; amount: number; overdue: number }>();
        for (const collection of collections) {
            const remaining = remainingAmount(collection.totalAmount, collection.paidAmount);
            if (remaining <= 0.01) continue;
            const current = collectionMap.get(collection.ownerId) || { count: 0, amount: 0, overdue: 0 };
            current.count += 1;
            current.amount += remaining;
            if (collection.dueDate && collection.dueDate < now) current.overdue += 1;
            collectionMap.set(collection.ownerId, current);
        }

        const pendingSlipMap = new Map<string, number>();
        for (const slip of pendingSlips) {
            const ownerId = slip.billingCollection.ownerId;
            pendingSlipMap.set(ownerId, (pendingSlipMap.get(ownerId) || 0) + 1);
        }

        const items = owners.map((owner) => {
            const unbilled = unbilledMap.get(owner.id) || { count: 0, amount: 0 };
            const invoice = invoiceMap.get(owner.id) || { count: 0, amount: 0, overdue: 0 };
            const collection = collectionMap.get(owner.id) || { count: 0, amount: 0, overdue: 0 };
            const pendingPaymentReviews = pendingSlipMap.get(owner.id) || 0;
            const overdueDocuments = invoice.overdue + collection.overdue;
            const attention = deriveCustomerAttention({
                status: owner.status,
                creditLimit: Number(owner.creditLimit),
                legacyCurrentCredit: Number(owner.currentCredit),
                overdueDocuments,
                pendingPaymentReviews,
                unbilledAmount: unbilled.amount,
                invoiceOutstandingAmount: invoice.amount,
                collectionOutstandingAmount: collection.amount,
            });

            return {
                id: owner.id,
                name: owner.name,
                code: owner.code || null,
                phone: owner.phone || null,
                groupType: owner.groupType,
                status: owner.status,
                truckCount: owner._count.trucks,
                transactionCount: transactionCountMap.get(owner.id) || 0,
                creditLimit: Number(owner.creditLimit),
                legacyCurrentCredit: Number(owner.currentCredit),
                outstanding: {
                    unbilledAmount: unbilled.amount,
                    unbilledTransactionCount: unbilled.count,
                    invoiceAmount: invoice.amount,
                    invoiceDocumentCount: invoice.count,
                    collectionAmount: collection.amount,
                    collectionDocumentCount: collection.count,
                    combinedOutstandingSuppressed: true as const,
                },
                attention,
                nextAction: getCustomerNextAction({
                    id: owner.id,
                    overdueDocuments,
                    pendingPaymentReviews,
                    unbilledAmount: unbilled.amount,
                }),
            };
        });

        items.sort((a, b) => {
            const levelRank = { CRITICAL: 3, WARNING: 2, INFO: 1, NONE: 0 } as const;
            const levelDiff = levelRank[b.attention.level] - levelRank[a.attention.level];
            if (levelDiff !== 0) return levelDiff;
            return a.name.localeCompare(b.name, 'th');
        });

        const payload: CustomerListPayload = {
            generatedAt: now.toISOString(),
            items,
            summary: {
                customerCount: items.length,
                attentionCount: items.filter((item) => item.attention.level !== 'NONE').length,
                unbilledAmount: items.reduce((sum, item) => sum + item.outstanding.unbilledAmount, 0),
                invoiceOutstandingAmount: items.reduce((sum, item) => sum + item.outstanding.invoiceAmount, 0),
                collectionOutstandingAmount: items.reduce((sum, item) => sum + item.outstanding.collectionAmount, 0),
            },
            workflow: {
                combinedOutstandingSuppressed: true,
                legacyCreditIsAuthoritative: false,
            },
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[Customers GET]:', error);
        return NextResponse.json({ error: 'โหลดรายชื่อลูกค้าไม่สำเร็จ' }, { status: 500 });
    }
}
