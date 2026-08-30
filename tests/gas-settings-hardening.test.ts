import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const txMock = {
    gasSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
};
const prismaMock = {
    gasSettings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
};
const requireAdminApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
});

describe('GAS global fallback settings', () => {
    it('is ADMIN-only before reading settings', async () => {
        requireAdminApiMock.mockResolvedValue({ response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }) });
        const { GET } = await import('../src/app/api/v2/gas/settings/route');
        const response = await GET(new Request('http://localhost/api/v2/gas/settings') as never);
        expect(response.status).toBe(403);
        expect(prismaMock.gasSettings.findUnique).not.toHaveBeenCalled();
    });

    it('exposes only gasPrice and falls back to the program default when DB has no row', async () => {
        prismaMock.gasSettings.findUnique.mockResolvedValue(null);
        const { GET } = await import('../src/app/api/v2/gas/settings/route');
        const response = await GET(new Request('http://localhost/api/v2/gas/settings') as never);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            settings: { gasPrice: { key: 'gasPrice', value: '16.09', isDefault: true } },
        });
        expect(prismaMock.gasSettings.findUnique).toHaveBeenCalledWith({ where: { key: 'gasPrice' } });
    });

    it('rejects dead legacy setting keys and zero fallback price without a transaction', async () => {
        const { GET, POST } = await import('../src/app/api/v2/gas/settings/route');
        const deadRead = await GET(new Request('http://localhost/api/v2/gas/settings?key=tankCapacity') as never);
        expect(deadRead.status).toBe(404);
        const deadWrite = await POST(new Request('http://localhost/api/v2/gas/settings', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'tankCount', value: 3 }),
        }) as never);
        expect(deadWrite.status).toBe(400);
        const zeroWrite = await POST(new Request('http://localhost/api/v2/gas/settings', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'gasPrice', value: 0 }),
        }) as never);
        expect(zeroWrite.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('writes normalized fallback price and AuditLog in one bounded transaction', async () => {
        const previous = { id: 'setting-1', key: 'gasPrice', value: '16.09', updatedAt: new Date('2026-08-29T00:00:00Z') };
        const updated = { ...previous, value: '17.25', updatedAt: new Date('2026-08-30T00:00:00Z') };
        txMock.gasSettings.findUnique.mockResolvedValue(previous);
        txMock.gasSettings.upsert.mockResolvedValue(updated);
        txMock.auditLog.create.mockResolvedValue({});
        const { POST } = await import('../src/app/api/v2/gas/settings/route');
        const response = await POST(new Request('http://localhost/api/v2/gas/settings', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'gasPrice', value: 17.25 }),
        }) as never);
        expect(response.status).toBe(200);
        expect(txMock.gasSettings.upsert).toHaveBeenCalledWith({
            where: { key: 'gasPrice' }, update: { value: '17.25' }, create: { key: 'gasPrice', value: '17.25' },
        });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: 'admin-1', action: 'UPDATE', model: 'GasSettings', recordId: 'setting-1',
                oldData: { key: 'gasPrice', value: '16.09' },
                newData: expect.objectContaining({ key: 'gasPrice', value: '17.25', source: 'gas-global-fallback-price' }),
            }),
        }));
        expect(prismaMock.$transaction.mock.calls[0]?.[1]).toEqual({ maxWait: 5_000, timeout: 20_000 });
    });

    it('documents the real price priority and removes dead controls from the settings UI', () => {
        const page = readFileSync('src/app/admin/gas/settings/page.tsx', 'utf8');
        expect(page).toContain('ราคาประจำวัน → ราคาหลักของสถานี → fallback นี้');
        expect(page).not.toContain('tankCapacity');
        expect(page).not.toContain('tankCount');
        expect(page).not.toContain('alertLowGauge');
        expect(page).not.toContain('alertCriticalGauge');
        const workflow = readFileSync('src/lib/gas/v2-workflow.ts', 'utf8');
        expect(workflow).toContain('toPositiveNumber(station?.gasPrice)');
        expect(workflow).toContain('toPositiveNumber(setting?.value)');
    });
});
