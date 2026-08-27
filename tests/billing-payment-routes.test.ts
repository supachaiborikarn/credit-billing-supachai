import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = {
    invoice: {
        updateMany: vi.fn(),
    },
    payment: {
        create: vi.fn(),
    },
    paymentSlip: {
        update: vi.fn(),
        findMany: vi.fn(),
    },
    billingCollection: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
};

const prismaMock = {
    invoice: {
        findUnique: vi.fn(),
    },
    payment: {
        findMany: vi.fn(),
    },
    billingCollection: {
        findUnique: vi.fn(),
    },
    paymentSlip: {
        create: vi.fn(),
        findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
};

const requireAdminApiMock = vi.fn();
const requireApiSessionMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
    requireApiSession: requireApiSessionMock,
}));

function postRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('billing payment route guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminApiMock.mockResolvedValue({
            response: null,
            user: { id: 'admin-1', name: 'Admin', role: 'ADMIN' },
        });
        requireApiSessionMock.mockResolvedValue({
            response: null,
            user: { id: 'admin-1', name: 'Admin', role: 'ADMIN' },
        });
        prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    });

    it('rejects Invoice overpayment before opening a transaction', async () => {
        prismaMock.invoice.findUnique.mockResolvedValue({
            id: 'inv-1',
            totalAmount: 1000,
            paidAmount: 900,
            status: 'PARTIAL',
        });

        const { POST } = await import('../src/app/api/invoices/[id]/payments/route');
        const response = await POST(
            postRequest('http://localhost/api/invoices/inv-1/payments', { amount: 101 }),
            { params: Promise.resolve({ id: 'inv-1' }) }
        );

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('returns conflict when Invoice paidAmount changed concurrently', async () => {
        prismaMock.invoice.findUnique.mockResolvedValue({
            id: 'inv-1',
            totalAmount: 1000,
            paidAmount: 100,
            status: 'PARTIAL',
        });
        txMock.invoice.updateMany.mockResolvedValue({ count: 0 });

        const { POST } = await import('../src/app/api/invoices/[id]/payments/route');
        const response = await POST(
            postRequest('http://localhost/api/invoices/inv-1/payments', { amount: 100 }),
            { params: Promise.resolve({ id: 'inv-1' }) }
        );

        expect(response.status).toBe(409);
        expect(txMock.payment.create).not.toHaveBeenCalled();
    });

    it('creates Invoice payment only after optimistic update succeeds', async () => {
        prismaMock.invoice.findUnique.mockResolvedValue({
            id: 'inv-1',
            totalAmount: 1000,
            paidAmount: 100,
            status: 'PARTIAL',
        });
        txMock.invoice.updateMany.mockResolvedValue({ count: 1 });
        txMock.payment.create.mockResolvedValue({ id: 'pay-1', amount: 100 });

        const { POST } = await import('../src/app/api/invoices/[id]/payments/route');
        const response = await POST(
            postRequest('http://localhost/api/invoices/inv-1/payments', { amount: 100, paymentMethod: 'TRANSFER' }),
            { params: Promise.resolve({ id: 'inv-1' }) }
        );

        expect(response.status).toBe(200);
        expect(txMock.payment.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a second BillingCollection slip while one is pending', async () => {
        prismaMock.billingCollection.findUnique.mockResolvedValue({
            id: 'bc-1',
            totalAmount: 1000,
            paidAmount: 200,
            paymentSlips: [{ id: 'pending-slip' }],
        });

        const { POST } = await import('../src/app/api/billing-collections/[id]/payment-slips/route');
        const response = await POST(
            postRequest('http://localhost/api/billing-collections/bc-1/payment-slips', {
                slipImageUrl: 'https://example.com/slip.webp',
                amount: 100,
            }),
            { params: Promise.resolve({ id: 'bc-1' }) }
        );

        expect(response.status).toBe(409);
        expect(prismaMock.paymentSlip.create).not.toHaveBeenCalled();
    });

    it('rolls back BillingCollection verification when verified slips would overpay', async () => {
        prismaMock.paymentSlip.findFirst.mockResolvedValue({
            id: 'slip-2',
            billingCollectionId: 'bc-1',
            amount: 200,
            notes: null,
        });
        txMock.paymentSlip.update.mockResolvedValue({ id: 'slip-2', status: 'VERIFIED', amount: 200 });
        txMock.paymentSlip.findMany.mockResolvedValue([
            { id: 'slip-1', amount: 900 },
            { id: 'slip-2', amount: 200 },
        ]);
        txMock.billingCollection.findUnique.mockResolvedValue({ id: 'bc-1', totalAmount: 1000 });

        const { PATCH } = await import('../src/app/api/billing-collections/[id]/payment-slips/[slipId]/route');
        const response = await PATCH(
            new Request('http://localhost/api/billing-collections/bc-1/payment-slips/slip-2', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VERIFIED' }),
            }),
            { params: Promise.resolve({ id: 'bc-1', slipId: 'slip-2' }) }
        );

        expect(response.status).toBe(409);
        expect(txMock.billingCollection.update).not.toHaveBeenCalled();
    });

    it('rejects BillingCollection overpayment on the server', async () => {
        prismaMock.billingCollection.findUnique.mockResolvedValue({
            id: 'bc-1',
            totalAmount: 1000,
            paidAmount: 900,
            paymentSlips: [],
        });

        const { POST } = await import('../src/app/api/billing-collections/[id]/payment-slips/route');
        const response = await POST(
            postRequest('http://localhost/api/billing-collections/bc-1/payment-slips', {
                slipImageUrl: 'https://example.com/slip.webp',
                amount: 101,
            }),
            { params: Promise.resolve({ id: 'bc-1' }) }
        );

        expect(response.status).toBe(400);
        expect(prismaMock.paymentSlip.create).not.toHaveBeenCalled();
    });
});
