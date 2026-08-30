import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    invoice: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    transaction: {
        findMany: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    owner: {
        findUnique: vi.fn(),
    },
    transaction: {
        findMany: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('monthly invoice service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    });

    it('builds exact Bangkok month boundaries and next-month due date', async () => {
        const { getMonthlyInvoicePeriod } = await import('../src/services/monthly-invoice-service');
        const period = getMonthlyInvoicePeriod(8, 2026);

        expect(period.startDate.toISOString()).toBe('2026-07-31T17:00:00.000Z');
        expect(period.endDate.toISOString()).toBe('2026-08-31T16:59:59.999Z');
        expect(period.statementDate.toISOString()).toBe('2026-08-31T17:00:00.000Z');
        expect(period.dueDate.toISOString()).toBe('2026-09-14T17:00:00.000Z');
        expect(period.dueDateEnd.toISOString()).toBe('2026-09-15T16:59:59.999Z');
    });

    it('loads only unbilled active credit transactions for the requested owner/month', async () => {
        prismaMock.owner.findUnique.mockResolvedValue({ id: 'owner-1', name: 'Owner 1' });
        prismaMock.transaction.findMany.mockResolvedValue([
            { id: 'txn-1', date: new Date('2026-08-10T01:00:00Z'), amount: 100, licensePlate: 'AA-1' },
        ]);

        const { generateMonthlyInvoiceData } = await import('../src/services/monthly-invoice-service');
        const data = await generateMonthlyInvoiceData('owner-1', 8, 2026);

        expect(data?.totalAmount).toBe(100);
        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                ownerId: 'owner-1',
                invoiceId: null,
                isVoided: false,
                deletedAt: null,
            }),
        }));
    });

    it('rechecks source rows inside a serializable write, connects them, and audits the Invoice', async () => {
        txMock.invoice.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        txMock.transaction.findMany.mockResolvedValue([
            { id: 'txn-1', amount: 100 },
            { id: 'txn-2', amount: 200 },
        ]);
        txMock.invoice.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-20260830-001' });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

        const { createMonthlyInvoice } = await import('../src/services/monthly-invoice-service');
        const result = await createMonthlyInvoice({
            ownerId: 'owner-1',
            ownerName: 'Owner 1',
            transactions: [
                { id: 'txn-1', date: new Date(), amount: 100, licensePlate: null },
                { id: 'txn-2', date: new Date(), amount: 200, licensePlate: null },
            ],
            totalAmount: 300,
            statementDate: new Date('2026-08-31T17:00:00Z'),
            dueDate: new Date('2026-09-14T17:00:00Z'),
            month: 8,
            year: 2026,
        }, 'admin-1');

        expect(result.success).toBe(true);
        expect(txMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ invoiceId: null, ownerId: 'owner-1' }),
        }));
        expect(txMock.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                ownerId: 'owner-1',
                totalAmount: 300,
                transactions: { connect: [{ id: 'txn-1' }, { id: 'txn-2' }] },
            }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin-1',
                action: 'CREATE',
                model: 'Invoice',
                recordId: 'inv-1',
                newData: expect.objectContaining({ source: 'MONTHLY_BATCH', transactionCount: 2 }),
            }),
        });
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
            isolationLevel: 'Serializable',
        }));
    });

    it('fails closed across legacy UTC and canonical Bangkok representations of the same due-date day', async () => {
        txMock.invoice.findFirst.mockResolvedValue({ id: 'existing-1', invoiceNumber: 'INV-OLD' });

        const { createMonthlyInvoice } = await import('../src/services/monthly-invoice-service');
        const result = await createMonthlyInvoice({
            ownerId: 'owner-1',
            ownerName: 'Owner 1',
            transactions: [{ id: 'txn-1', date: new Date(), amount: 100, licensePlate: null }],
            totalAmount: 100,
            statementDate: new Date('2026-08-31T17:00:00Z'),
            dueDate: new Date('2026-09-14T17:00:00Z'),
            month: 8,
            year: 2026,
        }, 'admin-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('มีใบแจ้งหนี้');
        expect(txMock.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                ownerId: 'owner-1',
                dueDate: {
                    gte: new Date('2026-09-14T17:00:00.000Z'),
                    lte: new Date('2026-09-15T16:59:59.999Z'),
                },
            },
        }));
        expect(txMock.transaction.findMany).not.toHaveBeenCalled();
        expect(txMock.invoice.create).not.toHaveBeenCalled();
    });

    it('discovers batch owners from unbilled transactions instead of currentCredit', async () => {
        prismaMock.transaction.findMany
            .mockResolvedValueOnce([{ ownerId: 'owner-1' }])
            .mockResolvedValueOnce([{ id: 'txn-1', date: new Date(), amount: 150, licensePlate: null }]);
        prismaMock.owner.findUnique.mockResolvedValue({ id: 'owner-1', name: 'Owner 1' });
        txMock.invoice.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        txMock.transaction.findMany.mockResolvedValue([{ id: 'txn-1', amount: 150 }]);
        txMock.invoice.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-20260830-001' });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

        const { generateAllMonthlyInvoices } = await import('../src/services/monthly-invoice-service');
        const result = await generateAllMonthlyInvoices(8, 2026, 'admin-1');

        expect(result).toEqual({ total: 1, created: 1, skipped: 0, errors: 0 });
        const discoveryCall = prismaMock.transaction.findMany.mock.calls[0][0];
        expect(discoveryCall.where).toEqual(expect.objectContaining({
            ownerId: { not: null },
            invoiceId: null,
            isVoided: false,
            deletedAt: null,
        }));
        expect(JSON.stringify(discoveryCall)).not.toContain('currentCredit');
    });
});
