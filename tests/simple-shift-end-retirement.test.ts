import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStationAccessApiMock = vi.fn();
const closeFullShiftMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));
vi.mock('@/lib/full-shift-close', () => ({ closeFullShift: closeFullShiftMock }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/shift-transaction-utils', () => ({ listTransactionsForShiftWindow: vi.fn() }));

beforeEach(() => {
    requireStationAccessApiMock.mockReset();
    closeFullShiftMock.mockReset();
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'staff-2', role: 'STAFF', stationId: 'station-2' },
    });
});

describe('retired SIMPLE shift-end write API', () => {
    it('checks station access before retirement metadata', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-end/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/2/shift-end', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(403);
        expect(closeFullShiftMock).not.toHaveBeenCalled();
    });

    it('returns 410 for retired SIMPLE stations without calling closeFullShift', async () => {
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-end/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/2/shift-end', {
                method: 'POST',
                body: JSON.stringify({ shiftId: 'shift-2', meters: [] }),
            }) as never,
            { params: Promise.resolve({ id: '2' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Legacy SIMPLE shift-end write API retired',
            retired: true,
            replacement: '/stations/station-2/history',
        });
        expect(closeFullShiftMock).not.toHaveBeenCalled();
    });

    it('points station-1 legacy callers to canonical Operations', async () => {
        requireStationAccessApiMock.mockResolvedValue({
            user: { id: 'admin-1', role: 'ADMIN', stationId: null },
        });
        const { POST } = await import('../src/app/api/simple-station/[id]/shift-end/route');
        const response = await POST(
            new Request('http://localhost/api/simple-station/1/shift-end', { method: 'POST' }) as never,
            { params: Promise.resolve({ id: 'station-1' }) },
        );
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({ replacement: '/stations/station-1/operations' });
        expect(closeFullShiftMock).not.toHaveBeenCalled();
    });
});
