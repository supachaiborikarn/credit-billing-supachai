import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStationAccessApiMock = vi.fn();
const shiftUpdateMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        dailyRecord: { findFirst: vi.fn() },
        shift: { findFirst: vi.fn(), update: shiftUpdateMock },
    },
}));

beforeEach(() => {
    requireStationAccessApiMock.mockReset();
    shiftUpdateMock.mockReset();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'staff-1', role: 'STAFF', stationId: 'station-2' },
    });
});

describe('retired SIMPLE shift-status force-close mutation', () => {
    it('keeps station access auth before retirement metadata', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-status/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/2/shift-status', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(403);
        expect(shiftUpdateMock).not.toHaveBeenCalled();
    });

    it('returns 410 for retired SIMPLE stations without mutating Shift', async () => {
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-status/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/2/shift-status', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Legacy SIMPLE force-close API retired',
            retired: true,
            replacement: '/stations/station-2/history',
        });
        expect(shiftUpdateMock).not.toHaveBeenCalled();
    });

    it('points station-1 legacy callers to canonical Operations', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            user: { id: 'admin-1', role: 'ADMIN', stationId: null },
        });
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-status/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/1/shift-status', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: 'station-1' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            replacement: '/stations/station-1/operations',
        });
        expect(shiftUpdateMock).not.toHaveBeenCalled();
    });
});
