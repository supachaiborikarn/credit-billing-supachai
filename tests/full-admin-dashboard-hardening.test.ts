import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildFullDashboardFacts, isValidFullDashboardDateKey } from '../src/lib/full/admin-dashboard';
import type { OperationalSaleRow } from '../src/lib/operational-sales';

const {
    requireAdminApiMock,
    getOperationalSalesDatasetMock,
    transactionCountMock,
} = vi.hoisted(() => ({
    requireAdminApiMock: vi.fn(),
    getOperationalSalesDatasetMock: vi.fn(),
    transactionCountMock: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/operational-sales', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/lib/operational-sales')>();
    return { ...original, getOperationalSalesDataset: getOperationalSalesDatasetMock };
});
vi.mock('@/lib/prisma', () => ({ prisma: { transaction: { count: transactionCountMock } } }));

function row(dateKey: string, liters: number, revenue: number, fuelType = 'ดีเซล'): OperationalSaleRow {
    return {
        source: 'internal',
        stationId: 'station-1',
        dateKey,
        soldAt: new Date(`${dateKey}T05:00:00.000Z`),
        liters,
        revenue,
        paymentType: 'CASH',
        pricePerLiter: liters > 0 ? revenue / liters : 0,
        billBookNo: null,
        billNo: null,
        nozzleNumber: 1,
        fuelType,
        ownerId: null,
        ownerName: null,
    };
}

beforeEach(() => {
    requireAdminApiMock.mockReset();
    getOperationalSalesDatasetMock.mockReset();
    transactionCountMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    getOperationalSalesDatasetMock.mockResolvedValue({ rows: [], watcharaExternal: undefined });
    transactionCountMock.mockResolvedValue(0);
});

describe('FULL admin dashboard hardening', () => {
    it('validates real calendar date keys', () => {
        expect(isValidFullDashboardDateKey('2026-08-30')).toBe(true);
        expect(isValidFullDashboardDateKey('2026-02-29')).toBe(false);
        expect(isValidFullDashboardDateKey('2026-8-30')).toBe(false);
        expect(isValidFullDashboardDateKey('bad')).toBe(false);
    });

    it('blocks non-admin before report data access', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/v2/full/admin/dashboard/route');
        const response = await GET(new NextRequest('http://localhost/api/v2/full/admin/dashboard?date=2026-08-30'));
        expect(response.status).toBe(403);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
        expect(transactionCountMock).not.toHaveBeenCalled();
    });

    it('rejects invalid date before report data access', async () => {
        const { GET } = await import('../src/app/api/v2/full/admin/dashboard/route');
        const response = await GET(new NextRequest('http://localhost/api/v2/full/admin/dashboard?date=2026-02-29'));
        expect(response.status).toBe(400);
        expect(getOperationalSalesDatasetMock).not.toHaveBeenCalled();
    });

    it('queries Bangkok-selected month/trend scope and void count', async () => {
        const { GET } = await import('../src/app/api/v2/full/admin/dashboard/route');
        const response = await GET(new NextRequest('http://localhost/api/v2/full/admin/dashboard?date=2026-08-15'));
        expect(response.status).toBe(200);
        expect(getOperationalSalesDatasetMock).toHaveBeenCalledWith({
            stationIds: ['station-1'],
            startDateKey: '2026-07-17',
            endDateKey: '2026-08-15',
        });
        expect(transactionCountMock).toHaveBeenCalledWith({
            where: {
                stationId: 'station-1',
                date: { gte: new Date('2026-08-14T17:00:00.000Z'), lte: new Date('2026-08-15T16:59:59.999Z') },
                isVoided: true,
                deletedAt: null,
            },
        });
    });

    it('derives selected-day, selected-month and fuel facts without server-local date setters', () => {
        const facts = buildFullDashboardFacts([
            row('2026-08-01', 10, 300, 'ดีเซล'),
            row('2026-08-14', 20, 600, 'ดีเซล'),
            row('2026-08-15', 25, 800, 'เบนซิน95'),
            row('2026-07-31', 99, 9999, 'ดีเซล'),
        ], '2026-08-15', 2);

        expect(facts.kpi.today).toEqual({ liters: 25, revenue: 800, transactions: 1 });
        expect(facts.kpi.month).toEqual({ liters: 55, revenue: 1700, transactions: 3 });
        expect(facts.dailyTrend).toHaveLength(30);
        expect(facts.dailyTrend.at(-1)).toMatchObject({ date: '2026-08-15', liters: 25, revenue: 800, count: 1 });
        expect(facts.byFuelType).toEqual([{ fuelType: 'เบนซิน95', liters: 25, revenue: 800, count: 1 }]);
        expect(facts.anomalies).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'VOIDED_TRANSACTIONS', severity: 'WARNING', date: '2026-08-15' }),
        ]));
    });
});
