import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const adjustInventoryMock = vi.fn();
const checkLowStockMock = vi.fn();
const getStationInventorySummaryMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/services/inventory-service', () => ({
    adjustInventory: adjustInventoryMock,
    checkLowStock: checkLowStockMock,
    getStationInventorySummary: getStationInventorySummaryMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
});

describe('S107/S121 inventory admin route guards', () => {
    it('blocks STAFF adjustment before touching inventory', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { POST } = await import('../src/app/api/admin/inventory/adjust/route');
        const response = await POST(new Request('http://localhost/api/admin/inventory/adjust', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stationId: 'station-5', productId: 'product-1', quantityChange: 2, reason: 'ตรวจนับ' }),
        }));
        expect(response.status).toBe(403);
        expect(adjustInventoryMock).not.toHaveBeenCalled();
    });

    it('requires an integer change and a meaningful reason', async () => {
        const { POST } = await import('../src/app/api/admin/inventory/adjust/route');
        const badQuantity = await POST(new Request('http://localhost/api/admin/inventory/adjust', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stationId: 'station-5', productId: 'product-1', quantityChange: 1.5, reason: 'ตรวจนับ' }),
        }));
        expect(badQuantity.status).toBe(400);
        const badReason = await POST(new Request('http://localhost/api/admin/inventory/adjust', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stationId: 'station-5', productId: 'product-1', quantityChange: 1, reason: 'x' }),
        }));
        expect(badReason.status).toBe(400);
        expect(adjustInventoryMock).not.toHaveBeenCalled();
    });

    it('passes ADMIN identity and reason into audited adjustment service', async () => {
        adjustInventoryMock.mockResolvedValue({ success: true, inventoryId: 'inv-1', previousQuantity: 0, newQuantity: 5 });
        const { POST } = await import('../src/app/api/admin/inventory/adjust/route');
        const response = await POST(new Request('http://localhost/api/admin/inventory/adjust', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stationId: 'station-5', productId: 'product-1', quantityChange: 5, reason: 'นับสต็อกจริง' }),
        }));
        expect(response.status).toBe(200);
        expect(adjustInventoryMock).toHaveBeenCalledWith('station-5', 'product-1', 5, 'admin-1', 'นับสต็อกจริง');
        await expect(response.json()).resolves.toMatchObject({ previousQuantity: 0, newQuantity: 5 });
    });

    it('protects the low-stock endpoint with ADMIN auth and returns zero-stock alerts', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { GET } = await import('../src/app/api/inventory/low-stock/route');
        const blocked = await GET(new Request('http://localhost/api/inventory/low-stock?stationId=station-5'));
        expect(blocked.status).toBe(403);
        expect(checkLowStockMock).not.toHaveBeenCalled();

        requireAdminApiMock.mockResolvedValueOnce({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
        checkLowStockMock.mockResolvedValue([{ productId: 'p-1', productName: 'หมด', currentStock: 0, alertLevel: 2, percentRemaining: 0 }]);
        const allowed = await GET(new Request('http://localhost/api/inventory/low-stock?stationId=station-5'));
        expect(allowed.status).toBe(200);
        expect(checkLowStockMock).toHaveBeenCalledWith('station-5');
        await expect(allowed.json()).resolves.toMatchObject({ count: 1, hasAlerts: true });
    });

    it('fails closed for stations that do not own product inventory', async () => {
        const { GET: getInventory } = await import('../src/app/api/admin/inventory/route');
        const inventoryResponse = await getInventory(new NextRequest('http://localhost/api/admin/inventory?stationId=station-6'));
        expect(inventoryResponse.status).toBe(400);
        expect(getStationInventorySummaryMock).not.toHaveBeenCalled();

        const { GET: getLowStock } = await import('../src/app/api/inventory/low-stock/route');
        const lowStockResponse = await getLowStock(new Request('http://localhost/api/inventory/low-stock?stationId=station-2'));
        expect(lowStockResponse.status).toBe(400);
        expect(checkLowStockMock).not.toHaveBeenCalled();

        const { POST } = await import('../src/app/api/admin/inventory/adjust/route');
        const adjustResponse = await POST(new Request('http://localhost/api/admin/inventory/adjust', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stationId: 'station-6', productId: 'product-1', quantityChange: 1, reason: 'ตรวจนับจริง' }),
        }));
        expect(adjustResponse.status).toBe(400);
        expect(adjustInventoryMock).not.toHaveBeenCalled();
    });

    it('keeps scoped compatibility reads for the configured product station', async () => {
        getStationInventorySummaryMock.mockResolvedValue([{ productId: 'p-1' }]);
        const { GET: getInventory } = await import('../src/app/api/admin/inventory/route');
        const inventoryResponse = await getInventory(new NextRequest('http://localhost/api/admin/inventory?stationId=station-5'));
        expect(inventoryResponse.status).toBe(200);
        expect(getStationInventorySummaryMock).toHaveBeenCalledWith('station-5');

        checkLowStockMock.mockResolvedValue([]);
        const { GET: getLowStock } = await import('../src/app/api/inventory/low-stock/route');
        const lowStockResponse = await getLowStock(new Request('http://localhost/api/inventory/low-stock'));
        expect(lowStockResponse.status).toBe(200);
        expect(checkLowStockMock).toHaveBeenCalledWith(undefined);
    });
});
