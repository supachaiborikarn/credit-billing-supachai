import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    requireAdminApi: vi.fn(),
    findMany: vi.fn(),
    checkAndSave: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: mocks.requireAdminApi }));
vi.mock('@/lib/prisma', () => ({ prisma: { dailyAnomaly: { findMany: mocks.findMany } } }));
vi.mock('@/services/daily-anomaly-detection', () => ({ checkAndSaveDailyAnomaly: mocks.checkAndSave }));

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdminApi.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.findMany.mockResolvedValue([]);
    mocks.checkAndSave.mockResolvedValue({ result: { hasAnomaly: false } });
});

describe('daily anomaly admin hardening', () => {
    it('keeps GET read-only and ADMIN guarded', async () => {
        const { GET } = await import('../src/app/api/admin/daily-anomalies/route');
        const response = await GET(new NextRequest('http://localhost/api/admin/daily-anomalies?status=pending'));
        expect(response.status).toBe(200);
        expect(mocks.findMany).toHaveBeenCalledTimes(1);
        expect(mocks.checkAndSave).not.toHaveBeenCalled();
    });

    it.each([
        ['status=bad', 'Invalid anomaly status'],
        ['status=pending&stationId=station-5', 'Invalid FULL station'],
    ])('rejects invalid GET filter %s', async (query, error) => {
        const { GET } = await import('../src/app/api/admin/daily-anomalies/route');
        const response = await GET(new NextRequest(`http://localhost/api/admin/daily-anomalies?${query}`));
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error });
        expect(mocks.findMany).not.toHaveBeenCalled();
        expect(mocks.checkAndSave).not.toHaveBeenCalled();
    });

    it.each([0, 91, 1.5])('rejects explicit scan days=%s outside bounded integer range', async (days) => {
        const { POST } = await import('../src/app/api/admin/daily-anomalies/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/daily-anomalies', {
            method: 'POST', body: JSON.stringify({ days }),
        }));
        expect(response.status).toBe(400);
        expect(mocks.checkAndSave).not.toHaveBeenCalled();
    });

    it('scans only configured FULL station on explicit ADMIN POST', async () => {
        const { POST } = await import('../src/app/api/admin/daily-anomalies/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/daily-anomalies', {
            method: 'POST', body: JSON.stringify({ days: 2 }),
        }));
        expect(response.status).toBe(200);
        expect(mocks.checkAndSave).toHaveBeenCalledTimes(2);
        expect(mocks.checkAndSave.mock.calls.every((call) => call[0] === 'station-1')).toBe(true);
        await expect(response.json()).resolves.toMatchObject({ scanned: 1, days: 2 });
    });
});
