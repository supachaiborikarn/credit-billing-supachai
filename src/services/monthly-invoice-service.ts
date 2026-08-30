import { Prisma } from '@prisma/client';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { getEndOfDayBangkok, getStartOfDayBangkok } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import { buildInvoiceNumberPrefix } from '@/lib/billing/document-number';

const invoicePaymentTypes = [...CREDIT_PAYMENT_TYPES];
const MONTHLY_INVOICE_WRITE_OPTIONS = {
    maxWait: 5000,
    timeout: 20000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export interface MonthlyInvoiceData {
    ownerId: string;
    ownerName: string;
    transactions: Array<{
        id: string;
        date: Date;
        amount: number;
        licensePlate: string | null;
    }>;
    totalAmount: number;
    statementDate: Date;
    dueDate: Date;
    month: number;
    year: number;
}

export interface MonthlyInvoiceCreateResult {
    success: boolean;
    invoiceId?: string;
    invoiceNumber?: string;
    transactionCount?: number;
    error?: string;
}

export interface MonthlyInvoiceBatchResult {
    total: number;
    created: number;
    skipped: number;
    errors: number;
}

export function getMonthlyInvoicePeriod(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('INVALID_MONTH');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error('INVALID_YEAR');
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDateKey = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateKey = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const statementDateKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const dueDateKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;

    return {
        startDateKey,
        endDateKey,
        statementDateKey,
        dueDateKey,
        startDate: getStartOfDayBangkok(startDateKey),
        endDate: getEndOfDayBangkok(endDateKey),
        statementDate: getStartOfDayBangkok(statementDateKey),
        dueDate: getStartOfDayBangkok(dueDateKey),
        dueDateEnd: getEndOfDayBangkok(dueDateKey),
    };
}

export async function generateMonthlyInvoiceData(
    ownerId: string,
    month: number,
    year: number
): Promise<MonthlyInvoiceData | null> {
    const period = getMonthlyInvoicePeriod(month, year);
    const owner = await prisma.owner.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true },
    });
    if (!owner) return null;

    const transactions = await prisma.transaction.findMany({
        where: {
            ownerId,
            paymentType: { in: invoicePaymentTypes },
            invoiceId: null,
            date: { gte: period.startDate, lte: period.endDate },
            isVoided: false,
            deletedAt: null,
        },
        select: {
            id: true,
            date: true,
            amount: true,
            licensePlate: true,
        },
        orderBy: { date: 'asc' },
    });
    if (transactions.length === 0) return null;

    return {
        ownerId: owner.id,
        ownerName: owner.name,
        transactions: transactions.map((transaction) => ({
            id: transaction.id,
            date: transaction.date,
            amount: Number(transaction.amount),
            licensePlate: transaction.licensePlate,
        })),
        totalAmount: transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
        statementDate: period.statementDate,
        dueDate: period.dueDate,
        month,
        year,
    };
}

export async function createMonthlyInvoice(
    data: MonthlyInvoiceData,
    userId: string
): Promise<MonthlyInvoiceCreateResult> {
    try {
        return await prisma.$transaction(async (tx) => {
            const period = getMonthlyInvoicePeriod(data.month, data.year);
            const existingInvoice = await tx.invoice.findFirst({
                where: {
                    ownerId: data.ownerId,
                    dueDate: {
                        gte: period.dueDate,
                        lte: period.dueDateEnd,
                    },
                },
                select: { id: true, invoiceNumber: true },
            });
            if (existingInvoice) {
                return {
                    success: false,
                    invoiceId: existingInvoice.id,
                    invoiceNumber: existingInvoice.invoiceNumber,
                    error: 'มีใบแจ้งหนี้สำหรับเดือนนี้แล้ว',
                };
            }

            const eligibleTransactions = await tx.transaction.findMany({
                where: {
                    id: { in: data.transactions.map((transaction) => transaction.id) },
                    ownerId: data.ownerId,
                    paymentType: { in: invoicePaymentTypes },
                    invoiceId: null,
                    isVoided: false,
                    deletedAt: null,
                },
                select: { id: true, amount: true },
                orderBy: { date: 'asc' },
            });
            if (eligibleTransactions.length === 0) {
                return { success: false, error: 'ไม่มีรายการที่ยังไม่ถูกวางบิล' };
            }

            const totalAmount = eligibleTransactions.reduce(
                (sum, transaction) => sum + Number(transaction.amount),
                0
            );
            const prefix = buildInvoiceNumberPrefix();
            const lastInvoice = await tx.invoice.findFirst({
                where: { invoiceNumber: { startsWith: prefix } },
                orderBy: { invoiceNumber: 'desc' },
                select: { invoiceNumber: true },
            });
            const previous = lastInvoice
                ? Number.parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10)
                : 0;
            const next = Number.isFinite(previous) ? previous + 1 : 1;
            const invoiceNumber = `${prefix}${String(next).padStart(3, '0')}`;

            const invoice = await tx.invoice.create({
                data: {
                    ownerId: data.ownerId,
                    invoiceNumber,
                    totalAmount,
                    paidAmount: 0,
                    dueDate: period.dueDate,
                    status: 'PENDING',
                    notes: `Monthly batch ${String(data.month).padStart(2, '0')}/${data.year}`,
                    transactions: {
                        connect: eligibleTransactions.map((transaction) => ({ id: transaction.id })),
                    },
                },
                select: { id: true, invoiceNumber: true },
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'CREATE',
                    model: 'Invoice',
                    recordId: invoice.id,
                    newData: {
                        source: 'MONTHLY_BATCH',
                        ownerId: data.ownerId,
                        invoiceNumber: invoice.invoiceNumber,
                        month: data.month,
                        year: data.year,
                        totalAmount,
                        transactionCount: eligibleTransactions.length,
                    },
                },
            });

            return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                transactionCount: eligibleTransactions.length,
            };
        }, MONTHLY_INVOICE_WRITE_OPTIONS);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
            return { success: false, error: 'มีการสร้าง Invoice พร้อมกัน กรุณารีเฟรชแล้วลองใหม่' };
        }
        console.error('[BILLING] Monthly invoice create error:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการสร้างใบแจ้งหนี้' };
    }
}

export async function generateAllMonthlyInvoices(
    month: number,
    year: number,
    userId: string
): Promise<MonthlyInvoiceBatchResult> {
    const period = getMonthlyInvoicePeriod(month, year);
    const ownerRows = await prisma.transaction.findMany({
        where: {
            ownerId: { not: null },
            paymentType: { in: invoicePaymentTypes },
            invoiceId: null,
            date: { gte: period.startDate, lte: period.endDate },
            isVoided: false,
            deletedAt: null,
        },
        select: { ownerId: true },
        distinct: ['ownerId'],
    });
    const ownerIds = ownerRows
        .map((row) => row.ownerId)
        .filter((ownerId): ownerId is string => Boolean(ownerId));

    const results: MonthlyInvoiceBatchResult = {
        total: ownerIds.length,
        created: 0,
        skipped: 0,
        errors: 0,
    };

    for (const ownerId of ownerIds) {
        const invoiceData = await generateMonthlyInvoiceData(ownerId, month, year);
        if (!invoiceData) {
            results.skipped++;
            continue;
        }

        const result = await createMonthlyInvoice(invoiceData, userId);
        if (result.success) {
            results.created++;
        } else if (result.error?.includes('มีใบแจ้งหนี้') || result.error?.includes('ไม่มีรายการ')) {
            results.skipped++;
        } else {
            results.errors++;
        }
    }

    return results;
}
