import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireGasStationAccessMock = vi.fn();

vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
}));

beforeEach(() => {
    requireGasStationAccessMock.mockReset();
    requireGasStationAccessMock.mockResolvedValue({
        station: { dbId: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์' },
        user: { id: 'staff-5', role: 'STAFF', stationId: 'station-5' },
    });
});

describe('legacy GAS transaction write retirement', () => {
    it('keeps station authorization before retiring legacy create', async () => {
        requireGasStationAccessMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/gas-station/[id]/transactions/route');
        const response = await POST(
            new Request('http://localhost/api/gas-station/5/transactions', { method: 'POST' }),
            { params: Promise.resolve({ id: '5' }) },
        );
        expect(response.status).toBe(403);
    });

    it('returns 410 with canonical SaleFlow replacement', async () => {
        const { POST } = await import('../src/app/api/gas-station/[id]/transactions/route');
        const response = await POST(
            new Request('http://localhost/api/gas-station/5/transactions', {
                method: 'POST',
                body: JSON.stringify({ paymentType: 'CASH', amount: 100 }),
            }),
            { params: Promise.resolve({ id: '5' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({
            error: 'Legacy GAS transaction write API retired',
            retired: true,
            canonicalSales: '/stations/station-5/sales',
            replacements: {
                saleApi: '/api/v2/gas/[stationId]/sell',
                shiftOperations: '/stations/station-5/operations',
                historicalAdminEntry: '/admin/gas/data-entry',
            },
        });
    });

    it('keeps station authorization before retiring legacy delete', async () => {
        requireGasStationAccessMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { DELETE } = await import('../src/app/api/gas-station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(
            new Request('http://localhost/api/gas-station/5/transactions/txn-1', { method: 'DELETE' }) as never,
            { params: Promise.resolve({ id: '5', transactionId: 'txn-1' }) },
        );
        expect(response.status).toBe(403);
    });

    it('returns 410 with the audited reason-bearing void replacement', async () => {
        const { DELETE } = await import('../src/app/api/gas-station/[id]/transactions/[transactionId]/route');
        const response = await DELETE(
            new Request('http://localhost/api/gas-station/5/transactions/txn-1', { method: 'DELETE' }) as never,
            { params: Promise.resolve({ id: '5', transactionId: 'txn-1' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({
            error: 'Legacy GAS transaction delete API retired',
            retired: true,
            canonicalHistory: '/stations/station-5/history',
            managementWorkspace: '/admin/transactions',
            replacementApi: '/api/station/station-5/transactions/txn-1',
            requiresReason: true,
        });
    });

    it('removes legacy Prisma write paths while keeping the canonical replacements', () => {
        const createSource = readFileSync('src/app/api/gas-station/[id]/transactions/route.ts', 'utf8');
        const deleteSource = readFileSync('src/app/api/gas-station/[id]/transactions/[transactionId]/route.ts', 'utf8');
        const saleSource = readFileSync('src/lib/sales/sale-api.ts', 'utf8');
        const gasPaymentSource = readFileSync('src/lib/gas/payment-utils.ts', 'utf8');
        const closingSource = readFileSync('src/components/stations/ShiftClosingFlow.tsx', 'utf8');
        const voidSource = readFileSync('src/app/api/station/[id]/transactions/[transactionId]/route.ts', 'utf8');

        expect(createSource).not.toContain("@/lib/prisma");
        expect(createSource).not.toContain('station.upsert');
        expect(createSource).not.toContain('dailyRecord.create');
        expect(createSource).not.toContain('transaction.create');
        expect(deleteSource).not.toContain("@/lib/prisma");
        expect(deleteSource).not.toContain('transaction.update');
        expect(deleteSource).not.toContain('auditLog.create');
        expect(saleSource).toContain('endpoint: `/api/v2/gas/${routeId}/sell`');
        expect(gasPaymentSource).toContain("['CASH', 'CREDIT', 'CREDIT_CARD', 'TRANSFER']");
        expect(gasPaymentSource).not.toContain("'EXPENSE'");
        expect(gasPaymentSource).not.toContain("'BOX_TRUCK'");
        expect(gasPaymentSource).not.toContain("'OIL_TRUCK_SUPACHAI'");
        expect(closingSource).toContain('otherExpensesAmount');
        expect(voidSource).toContain('voidReason: reason');
        expect(voidSource).toContain('reason.length < 3 || reason.length > 200');
        expect(voidSource).toContain('isVoided: false');
        expect(voidSource).toContain('deletedAt: null');
        expect(voidSource).toContain('if (result.count !== 1) return false');
        expect(voidSource).toContain('await prisma.$transaction(async (tx) =>');
    });
});
