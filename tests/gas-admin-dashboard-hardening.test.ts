import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLatestGaugeSummary,
    getGasDashboardDateWindow,
    moveGasDashboardDateKey,
} from '../src/lib/gas/admin-dashboard';

const requireAdminApiMock = vi.fn();
const getGasShiftAnalyticsDataMock = vi.fn();
const getGasAnalyticsStationIdsMock = vi.fn((stationId?: string | null) => {
    if (stationId === 'station-5') return ['station-5', 'd01b9c7b-fcf0-4185-a0b1-a5840391a61c'];
    if (stationId === 'station-6') return ['station-6', '6950b69c-1841-4d22-a915-22141b94ca46'];
    return ['station-5', 'd01b9c7b-fcf0-4185-a0b1-a5840391a61c', 'station-6', '6950b69c-1841-4d22-a915-22141b94ca46'];
});
const prismaMock = {
    gaugeReading: { findFirst: vi.fn() },
};

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/gas/admin-analytics', () => ({
    getGasShiftAnalyticsData: getGasShiftAnalyticsDataMock,
    getGasAnalyticsStationIds: getGasAnalyticsStationIdsMock,
}));
vi.mock('@/lib/gas/date-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/gas/date-utils')>();
    return { ...actual, getGasBusinessDateKey: () => '2026-08-30' };
});
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

function shift(input: {
    id: string;
    stationId: string;
    dateKey: string;
    total: number;
    liters: number;
    transactions: number;
    status?: string;
    shiftNumber?: number;
    staffName?: string | null;
    isSyntheticOrphan?: boolean;
}) {
    return {
        id: input.id,
        stationId: input.stationId,
        dateKey: input.dateKey,
        status: input.status ?? 'CLOSED',
        shiftNumber: input.shiftNumber ?? 1,
        staffName: input.staffName ?? null,
        isSyntheticOrphan: input.isSyntheticOrphan ?? false,
        sales: {
            total: input.total,
            liters: input.liters,
            transactions: input.transactions,
        },
    } as never;
}

beforeEach(() => {
    requireAdminApiMock.mockReset();
    getGasShiftAnalyticsDataMock.mockReset();
    getGasAnalyticsStationIdsMock.mockClear();
    prismaMock.gaugeReading.findFirst.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('GAS admin dashboard hardening', () => {
    it('clamps month shifts and keeps date math independent from server timezone', () => {
        expect(moveGasDashboardDateKey('2026-03-31', { months: -1 })).toBe('2026-02-28');
        expect(moveGasDashboardDateKey('2028-03-31', { months: -1 })).toBe('2028-02-29');
        expect(getGasDashboardDateWindow('2026-08-30')).toEqual({
            todayKey: '2026-08-30',
            weekStartKey: '2026-08-24',
            monthStartKey: '2026-07-30',
        });
    });

    it('uses the latest reading per tank instead of treating one row as the station average', () => {
        expect(buildLatestGaugeSummary([
            { tankNumber: 1, percentage: 10 },
            { tankNumber: 1, percentage: 80 },
            { tankNumber: 2, percentage: 40 },
            { tankNumber: 3, percentage: 70 },
        ])).toEqual({ tankCount: 3, average: 40, hasLowTank: true });
    });

    it('blocks non-admin requests before fact or gauge reads', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/v2/gas/admin/dashboard/route');
        const response = await GET();
        expect(response.status).toBe(403);
        expect(getGasShiftAnalyticsDataMock).not.toHaveBeenCalled();
        expect(prismaMock.gaugeReading.findFirst).not.toHaveBeenCalled();
    });

    it('derives totals from GAS facts and reads latest tank gauges across configured aliases', async () => {
        getGasShiftAnalyticsDataMock.mockResolvedValue([
            shift({ id: 's5-open', stationId: 'station-5', dateKey: '2026-08-30', total: 100, liters: 10, transactions: 2, status: 'OPEN', shiftNumber: 1, staffName: 'Staff 5' }),
            shift({ id: 's6-today', stationId: 'station-6', dateKey: '2026-08-30', total: 200, liters: 20, transactions: 3, shiftNumber: 2 }),
            shift({ id: 's5-week', stationId: 'station-5', dateKey: '2026-08-25', total: 50, liters: 5, transactions: 1 }),
            shift({ id: 's6-month', stationId: 'station-6', dateKey: '2026-08-01', total: 300, liters: 30, transactions: 4 }),
        ]);
        prismaMock.gaugeReading.findFirst
            .mockResolvedValueOnce({ tankNumber: 1, percentage: 10 })
            .mockResolvedValueOnce({ tankNumber: 2, percentage: 40 })
            .mockResolvedValueOnce({ tankNumber: 3, percentage: 70 })
            .mockResolvedValueOnce({ tankNumber: 1, percentage: 30 })
            .mockResolvedValueOnce({ tankNumber: 2, percentage: 40 })
            .mockResolvedValueOnce({ tankNumber: 3, percentage: 50 });

        const { GET } = await import('../src/app/api/v2/gas/admin/dashboard/route');
        const response = await GET();
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(getGasShiftAnalyticsDataMock).toHaveBeenCalledWith({
            fromDate: new Date('2026-07-29T17:00:00.000Z'),
            toDate: new Date('2026-08-30T16:59:59.999Z'),
        });
        expect(prismaMock.gaugeReading.findFirst).toHaveBeenNthCalledWith(1, {
            where: {
                stationId: { in: ['station-5', 'd01b9c7b-fcf0-4185-a0b1-a5840391a61c'] },
                tankNumber: 1,
            },
            select: { tankNumber: true, percentage: true },
            orderBy: { createdAt: 'desc' },
        });
        expect(prismaMock.gaugeReading.findFirst).toHaveBeenCalledTimes(6);
        expect(payload.summary).toEqual({
            todayTotal: 300,
            weekTotal: 350,
            monthTotal: 650,
            todayTransactions: 5,
            weekTransactions: 6,
            monthTransactions: 10,
            todayLiters: 30,
            weekLiters: 35,
            monthLiters: 65,
        });
        expect(payload.stations[0]).toMatchObject({
            id: 'station-5',
            currentShift: { shiftNumber: 1, status: 'OPEN', staffName: 'Staff 5' },
            todaySales: 100,
            gaugeAverage: 40,
            alerts: ['ระดับแก๊สต่ำ'],
        });
        expect(payload.stations[1]).toMatchObject({
            id: 'station-6',
            currentShift: null,
            todaySales: 200,
            gaugeAverage: 40,
            alerts: ['ยังไม่เปิดกะ'],
        });
    });

    it('does not silently replace a failed first dashboard load with zero-value demo data', () => {
        const source = readFileSync('src/app/admin/gas/page.tsx', 'utf8');
        expect(source).not.toContain('Default data for demo');
        expect(source).toContain('if (!data)');
        expect(source).toContain('กำลังแสดงข้อมูลครั้งล่าสุด');
        expect(source).toContain('ลองใหม่');
        expect(source).toContain('summary.weekLiters');
        expect(source).toContain('summary.monthTransactions');
    });
});
