import { NextResponse } from 'next/server';
import { Prisma, type Invoice, type Owner } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { buildInvoiceNumberPrefix } from '@/lib/billing/document-number';

type InvoiceWithRelations = Invoice & {
    owner: Pick<Owner, 'id' | 'name' | 'code'>;
    _count: { transactions: number };
};

const invoicePaymentTypes = [...CREDIT_PAYMENT_TYPES];
const INVOICE_WRITE_OPTIONS = {
    maxWait: 5000,
    timeout: 20000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

function parseBangkokDateRange(startDate?: string, endDate?: string) {
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
    if (startDate && endDate && startDate > endDate) return null;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00+07:00`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999+07:00`);
    return dateFilter;
}

function buildInvoiceNumber(prefix: string, previousNumber?: string | null) {
    const previous = previousNumber ? Number.parseInt(previousNumber.replace(prefix, ''), 10) : 0;
    const next = Number.isFinite(previous) ? previous + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
}

export async function GET() {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                owner: { select: { id: true, name: true, code: true } },
                _count: { select: { transactions: true } },
            },
        });

        return NextResponse.json(invoices);
    } catch (error) {
        console.error('Invoices GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const { ownerId, ownerIds, startDate, endDate, combineOwners } = body as {
            ownerId?: string;
            ownerIds?: string[];
            startDate?: string;
            endDate?: string;
            combineOwners?: boolean;
        };

        const rawOwnerIds = Array.isArray(ownerIds) ? ownerIds : ownerId ? [ownerId] : [];
        const targetOwnerIds = [...new Set(rawOwnerIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];

        if (targetOwnerIds.length === 0) {
            return NextResponse.json({ error: 'ต้องระบุเจ้าของอย่างน้อย 1 ราย' }, { status: 400 });
        }
        if (targetOwnerIds.length > 50) {
            return NextResponse.json({ error: 'สร้าง Invoice ได้ครั้งละไม่เกิน 50 ลูกค้า' }, { status: 400 });
        }
        if (combineOwners && targetOwnerIds.length > 1) {
            return NextResponse.json({
                error: 'ไม่รองรับการรวมหลายเจ้าของเป็น Invoice เดียว เพราะ Invoice มี ownerId ได้เพียง 1 ราย กรุณาสร้างแยกใบ',
            }, { status: 400 });
        }

        const dateFilter = parseBangkokDateRange(startDate, endDate);
        if (!dateFilter) {
            return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const createdInvoices = await prisma.$transaction(async (tx) => {
            const created: InvoiceWithRelations[] = [];
            const prefix = buildInvoiceNumberPrefix();

            for (const targetOwnerId of targetOwnerIds) {
                const owner = await tx.owner.findUnique({
                    where: { id: targetOwnerId },
                    select: { id: true },
                });
                if (!owner) throw new Error(`OWNER_NOT_FOUND:${targetOwnerId}`);

                const transactions = await tx.transaction.findMany({
                    where: {
                        ownerId: targetOwnerId,
                        paymentType: { in: invoicePaymentTypes },
                        invoiceId: null,
                        deletedAt: null,
                        isVoided: false,
                        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
                    },
                    select: { id: true, amount: true },
                });
                if (transactions.length === 0) continue;

                const totalAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
                const lastInvoice = await tx.invoice.findFirst({
                    where: { invoiceNumber: { startsWith: prefix } },
                    orderBy: { invoiceNumber: 'desc' },
                    select: { invoiceNumber: true },
                });
                const invoiceNumber = buildInvoiceNumber(prefix, lastInvoice?.invoiceNumber);

                const invoice = await tx.invoice.create({
                    data: {
                        invoiceNumber,
                        owner: { connect: { id: targetOwnerId } },
                        totalAmount,
                        paidAmount: 0,
                        status: 'PENDING',
                        transactions: { connect: transactions.map((transaction) => ({ id: transaction.id })) },
                    },
                    include: {
                        owner: { select: { id: true, name: true, code: true } },
                        _count: { select: { transactions: true } },
                    },
                });

                await tx.auditLog.create({
                    data: {
                        userId: auth.user.id,
                        action: 'CREATE',
                        model: 'Invoice',
                        recordId: invoice.id,
                        newData: {
                            invoiceNumber: invoice.invoiceNumber,
                            ownerId: targetOwnerId,
                            totalAmount,
                            transactionCount: transactions.length,
                            startDate: startDate || null,
                            endDate: endDate || null,
                        },
                    },
                });
                created.push(invoice);
            }
            return created;
        }, INVOICE_WRITE_OPTIONS);

        if (createdInvoices.length === 0) {
            return NextResponse.json({ error: 'ไม่มีรายการที่รอวางบิลในช่วงวันที่เลือก' }, { status: 400 });
        }
        if (createdInvoices.length === 1) return NextResponse.json(createdInvoices[0]);
        return NextResponse.json({ invoices: createdInvoices, count: createdInvoices.length });
    } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('OWNER_NOT_FOUND:')) {
            return NextResponse.json({ error: 'ไม่พบลูกค้าที่เลือก' }, { status: 404 });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
            return NextResponse.json({ error: 'มีการสร้าง Invoice พร้อมกัน กรุณารีเฟรชแล้วลองใหม่' }, { status: 409 });
        }
        console.error('Invoice POST error:', error);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}
