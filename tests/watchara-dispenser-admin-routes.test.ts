import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const getStatusMock = vi.fn();
const bootstrapMock = vi.fn();
const syncMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/watchara-dispenser-sync', () => ({
    getWatcharaDispenserStatus: getStatusMock,
    bootstrapWatcharaSalesSource: bootstrapMock,
    syncWatcharaDispenser: syncMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('S123 Watchara integration admin routes', () => {
    it('uses shared ADMIN auth before probing status', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { GET } = await import('../src/app/api/admin/watchara-dispenser/status/route');
        const response = await GET(new NextRequest('http://localhost/api/admin/watchara-dispenser/status?probe=1'));
        expect(response.status).toBe(403);
        expect(getStatusMock).not.toHaveBeenCalled();
    });

    it('rejects unsupported probe values before status work', async () => {
        const { GET } = await import('../src/app/api/admin/watchara-dispenser/status/route');
        const response = await GET(new NextRequest('http://localhost/api/admin/watchara-dispenser/status?probe=yes'));
        expect(response.status).toBe(400);
        expect(getStatusMock).not.toHaveBeenCalled();
    });

    it('passes ADMIN identity into audited bootstrap', async () => {
        bootstrapMock.mockResolvedValue({
            id: 'source-1', code: 'watchara_shared_dispenser', name: 'Watchara shared dispenser', stationId: 'station-2',
            sourceStationRef: 'station-1', fuelFamily: 'DIESEL', rollupMode: 'all_day_single_shift', isEnabled: true,
            lastSyncAttemptAt: null, lastSyncedAt: null, lastSeenSourceAt: null, lastError: null,
        });
        const { POST } = await import('../src/app/api/admin/watchara-dispenser/bootstrap/route');
        const response = await POST();
        expect(response.status).toBe(200);
        expect(bootstrapMock).toHaveBeenCalledWith('admin-1');
    });

    it('fails closed on malformed sync body types', async () => {
        const { POST } = await import('../src/app/api/admin/watchara-dispenser/sync/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/watchara-dispenser/sync', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ startDate: '2026-08-30', endDate: '2026-08-30', dryRun: 'false' }),
        }));
        expect(response.status).toBe(400);
        expect(syncMock).not.toHaveBeenCalled();
    });

    it('passes bounded sync input and ADMIN actor to the sync service', async () => {
        syncMock.mockResolvedValue({ sourceCode: 'watchara_shared_dispenser', startDate: '2026-08-30', endDate: '2026-08-30', dayCount: 1, dryRun: false, rowsFetched: 0, created: 0, updated: 0, latestSourceTransactionAt: null, stale: { isStale: false, staleHours: null, thresholdHours: 48 } });
        const { POST } = await import('../src/app/api/admin/watchara-dispenser/sync/route');
        const response = await POST(new NextRequest('http://localhost/api/admin/watchara-dispenser/sync', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ startDate: '2026-08-30', endDate: '2026-08-30', dryRun: false }),
        }));
        expect(response.status).toBe(200);
        expect(syncMock).toHaveBeenCalledWith({ startDate: '2026-08-30', endDate: '2026-08-30', dryRun: false, triggeredByUserId: 'admin-1' });
    });
});
