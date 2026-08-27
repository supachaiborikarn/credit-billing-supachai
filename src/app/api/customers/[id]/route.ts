import { NextResponse } from 'next/server';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { requireApiSession } from '@/lib/api-auth';
import {
    normalizeCollectionBillingDocument,
    normalizeInvoiceBillingDocument,
} from '@/lib/billing/adapter';
import {
    buildCustomerCreditContext,
    buildCustomerPaymentHistory,
    toCustomerBillingDocument,
} from '@/lib/customers/customer-360';
import { prisma } from '@/lib/prisma';
import type { Customer360Payload } from '@/types/customer';

const RECENT_TRANSACTION_LIMIT = 100;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;
        const now = new Date();

        const [owner, recentTransactions, activeTransactionCount, unbilledCredit, invoices, collections] = await Promise.all([
            prisma.owner.findUnique({
                where: { id },
                include: {
                    trucks: {
                        where: { deletedAt: null },
                        orderBy: { licensePlate: 'asc' },
                        select: {
                            id: true,
                            licensePlate: true,
                            code: true,
                            _count: { select: { transactions: true } },
                            transactions: {
                                where: { deletedAt: null, isVoided: false },
                                orderBy: { date: 'desc' },
                                take: 1,
                                select: { date: true },
                            },
                        },
                    },
                },
            }),
            prisma.transaction.findMany({
                where: { ownerId: id, deletedAt: null, isVoided: false },
                orderBy: { date: 'desc' },
                take: RECENT_TRANSACTION_LIMIT,
                include: {
                    station: { select: { id: true, name: true, type: true } },
                },
            }),
            prisma.transaction.count({
                where: { ownerId: id, deletedAt: null, isVoided: false },
            }),
            prisma.transaction.aggregate({
                where: {
                    ownerId: id,
                    paymentType: { in: CREDIT_PAYMENT_TYPES },
                    invoiceId: null,
                    deletedAt: null,
                    isVoided: false,
                },
                _count: { _all: true },
                _sum: { amount: true },
            }),
            prisma.invoice.findMany({
                where: { ownerId: id },
                orderBy: { createdAt: 'desc' },
                include: {
                    owner: { select: { id: true, name: true, code: true } },
                    payments: { orderBy: { paymentDate: 'desc' } },
                    _count: { select: { transactions: true } },
                },
            }),
            prisma.billingCollection.findMany({
                where: { ownerId: id },
                orderBy: { createdAt: 'desc' },
                include: {
                    owner: { select: { id: true, name: true, code: true } },
                    paymentSlips: { orderBy: { createdAt: 'desc' } },
                    _count: { select: { items: true, paymentSlips: true } },
                },
            }),
        ]);

        if (!owner) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 404 });
        }

        const normalizedDocuments = [
            ...invoices.map((invoice) => normalizeInvoiceBillingDocument(invoice, now)),
            ...collections.map((collection) => normalizeCollectionBillingDocument(collection, now)),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const credit = buildCustomerCreditContext({
            creditLimit: Number(owner.creditLimit),
            legacyCurrentCredit: Number(owner.currentCredit),
            unbilledTransactionCount: unbilledCredit._count._all,
            unbilledAmount: Number(unbilledCredit._sum.amount || 0),
            documents: normalizedDocuments,
        });

        const payload: Customer360Payload = {
            generatedAt: now.toISOString(),
            customer: {
                id: owner.id,
                name: owner.name,
                code: owner.code || null,
                venderCode: owner.venderCode || null,
                phone: owner.phone || null,
                groupType: owner.groupType,
                status: owner.status,
                createdAt: owner.createdAt.toISOString(),
            },
            trucks: owner.trucks.map((truck) => ({
                id: truck.id,
                licensePlate: truck.licensePlate,
                code: truck.code || null,
                transactionCount: truck._count.transactions,
                lastTransactionAt: truck.transactions[0]?.date.toISOString() || null,
            })),
            recentTransactions: recentTransactions.map((transaction) => ({
                id: transaction.id,
                stationId: transaction.stationId,
                stationName: transaction.station.name,
                stationType: transaction.station.type,
                date: transaction.date.toISOString(),
                licensePlate: transaction.licensePlate || null,
                truckId: transaction.truckId || null,
                paymentType: transaction.paymentType,
                liters: Number(transaction.liters),
                pricePerLiter: Number(transaction.pricePerLiter),
                amount: Number(transaction.amount),
                billBookNo: transaction.billBookNo || null,
                billNo: transaction.billNo || null,
                invoiceId: transaction.invoiceId || null,
            })),
            billingDocuments: normalizedDocuments.map(toCustomerBillingDocument),
            paymentHistory: buildCustomerPaymentHistory(normalizedDocuments),
            credit,
            counts: {
                trucks: owner.trucks.length,
                activeTransactions: activeTransactionCount,
                invoices: invoices.length,
                billingCollections: collections.length,
            },
            permissions: {
                canEditCustomer: auth.user.role === 'ADMIN',
                canManageCreditLimit: auth.user.role === 'ADMIN',
            },
            workflow: {
                transactionHistoryLimit: RECENT_TRANSACTION_LIMIT,
                combinedOutstandingSuppressed: true,
                creditSourceNote: 'currentCredit เป็นค่า legacy และไม่ถือเป็น source of truth; ยอดรอวางบิล, Invoice และ BillingCollection แสดงแยกเพื่อป้องกันการนับซ้ำ',
            },
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[Customer 360 GET]:', error);
        return NextResponse.json({ error: 'โหลดข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 });
    }
}
