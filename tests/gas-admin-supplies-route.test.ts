import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const requireGasStationAccessMock = vi.fn();
const resolveGasStationMock = vi.fn();
const buildSupplyGaugeChecksMock = vi.fn();
const buildStationStockForecastMock = vi.fn();

const txMock = {
    gasSupply: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const prismaMock = {
    $transaction: vi.fn(),
    gasSupply: {
        findMany: vi.fn(),
    },
};

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
}));

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/gas/station-resolver', () => ({
    resolveGasStation: resolveGasStationMock,
}));

vi.mock('@/lib/gas/stock-utils', () => ({
    buildSupplyGaugeChecks: buildSupplyGaugeChecksMock,
    buildStationStockForecast: buildStationStockForecastMock,
}));

const existingSupply = {
    id: 'supply-1',
    stationId: 'station-5',
    date: new Date('2026-08-29T17:00:00.000Z'),
    liters: 1000,
    supplier: 'Supplier A',
    invoiceNo: 'INV-1',
    pricePerLiter: 12.5,
    totalCost: 12500,
    notes: 'old',
    createdAt: new Date('2026-08-30T01:00:00.000Z'),
};

function resetMockTree(tree: Record<string, unknown>) {
    for (const value of Object.values(tree)) {
        if (typeof value === 'function' && 'mockReset' in value) {
            (value as ReturnType<typeof vi.fn>).mockReset();
            continue;
        }
        if (value && typeof value === 'object') resetMockTree(value as Record<string, unknown>);
    }
}

function jsonRequest(body: unknown, method = 'POST') {
    return new Request('http://localhost/api/test', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    resetMockTree(txMock);
    resetMockTree(prismaMock);
    requireAdminApiMock.mockReset();
    requireGasStationAccessMock.mockReset();
    resolveGasStationMock.mockReset();
    buildSupplyGaugeChecksMock.mockReset();
    buildStationStockForecastMock.mockReset();

    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    requireGasStationAccessMock.mockResolvedValue({
        user: { id: 'staff-1', role: 'STAFF' },
        station: { id: 'station-5', dbId: 'station-5', name: 'Gas 5', type: 'GAS', index: 5 },
    });
    resolveGasStationMock.mockImplementation(async (stationId: string) => {
        if (stationId === 'station-5') return { id: 'station-5', dbId: 'station-5', name: 'Gas 5', type: 'GAS', index: 5 };
        if (stationId === 'station-6') return { id: 'station-6', dbId: 'station-6', name: 'Gas 6', type: 'GAS', index: 6 };
        return null;
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    prismaMock.gasSupply.findMany.mockResolvedValue([]);
    buildSupplyGaugeChecksMock.mockResolvedValue(new Map());
    buildStationStockForecastMock.mockResolvedValue({
        stationId: 'station-5',
        currentStockLiters: null,
        capacityLiters: 21600,
        latestGaugeDateKey: null,
        avgDailySoldLiters: null,
        daysLeft: null,
        projectedEmptyDateKey: null,
        stockAlertLiters: null,
        lowStock: false,
    });
});

describe('GAS admin supplies list guards', () => {
    it('keeps ADMIN auth authoritative', async () => {
        requireAdminApiMock.mockResolvedValue({ response: new Response('forbidden', { status: 403 }) });
        const { GET } = await import('../src/app/api/v2/gas/admin/supplies/route');
        const response = await GET(new Request('http://localhost/api/v2/gas/admin/supplies') as never);
        expect(response.status).toBe(403);
        expect(prismaMock.gasSupply.findMany).not.toHaveBeenCalled();
    });

    it.each([
        ['stationId=station-2', 'station'],
        ['from=not-a-date', 'from'],
        ['to=2026-99-99', 'to'],
        ['from=2026-08-31&to=2026-08-01', 'range'],
    ])('rejects invalid filter %s before reading supplies (%s)', async (query) => {
        const { GET } = await import('../src/app/api/v2/gas/admin/supplies/route');
        const response = await GET(new Request(`http://localhost/api/v2/gas/admin/supplies?${query}`) as never);
        expect(response.status).toBe(400);
        expect(prismaMock.gasSupply.findMany).not.toHaveBeenCalled();
    });
});

describe('GAS admin supply mutations', () => {
    it('rejects malformed JSON instead of returning 500', async () => {
        const { POST } = await import('../src/app/api/v2/gas/admin/supplies/route');
        const response = await POST(new Request('http://localhost/api/v2/gas/admin/supplies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{bad',
        }) as never);
        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates the supply and AuditLog inside one bounded transaction', async () => {
        txMock.gasSupply.create.mockResolvedValue(existingSupply);
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

        const { POST } = await import('../src/app/api/v2/gas/admin/supplies/route');
        const response = await POST(jsonRequest({
            stationId: 'station-5',
            dateKey: '2026-08-30',
            liters: 1000,
            supplier: 'Supplier A',
            invoiceNo: 'INV-1',
            pricePerLiter: 12.5,
        }) as never);

        expect(response.status).toBe(200);
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
        expect(txMock.gasSupply.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stationId: 'station-5', liters: 1000, totalCost: 12500 }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'CREATE', model: 'GasSupply', recordId: 'supply-1' }),
        }));
    });

    it('updates the supply and AuditLog atomically without moving stations', async () => {
        txMock.gasSupply.findUnique.mockResolvedValue(existingSupply);
        txMock.gasSupply.update.mockResolvedValue({
            ...existingSupply,
            liters: 1100,
            totalCost: 13750,
            notes: 'corrected',
        });
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-2' });

        const { PUT } = await import('../src/app/api/v2/gas/admin/supplies/[supplyId]/route');
        const response = await PUT(jsonRequest({
            stationId: 'station-5',
            dateKey: '2026-08-30',
            liters: 1100,
            pricePerLiter: 12.5,
            notes: 'corrected',
        }, 'PUT') as never, { params: Promise.resolve({ supplyId: 'supply-1' }) });

        expect(response.status).toBe(200);
        expect(txMock.gasSupply.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'supply-1' },
            data: expect.not.objectContaining({ stationId: expect.anything() }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ action: 'UPDATE', model: 'GasSupply', recordId: 'supply-1' }),
        }));
    });

    it('fails closed when an edit tries to move a supply to another station', async () => {
        txMock.gasSupply.findUnique.mockResolvedValue(existingSupply);
        const { PUT } = await import('../src/app/api/v2/gas/admin/supplies/[supplyId]/route');
        const response = await PUT(jsonRequest({
            stationId: 'station-6',
            dateKey: '2026-08-30',
            liters: 1000,
        }, 'PUT') as never, { params: Promise.resolve({ supplyId: 'supply-1' }) });

        expect(response.status).toBe(400);
        expect(txMock.gasSupply.update).not.toHaveBeenCalled();
        expect(txMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('deletes the supply and stores its snapshot in the same transaction', async () => {
        txMock.gasSupply.findUnique.mockResolvedValue(existingSupply);
        txMock.gasSupply.delete.mockResolvedValue(existingSupply);
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-3' });

        const { DELETE } = await import('../src/app/api/v2/gas/admin/supplies/[supplyId]/route');
        const response = await DELETE(new Request('http://localhost/api/test', { method: 'DELETE' }) as never, {
            params: Promise.resolve({ supplyId: 'supply-1' }),
        });

        expect(response.status).toBe(200);
        expect(txMock.gasSupply.delete).toHaveBeenCalledWith({ where: { id: 'supply-1' } });
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: 'DELETE',
                model: 'GasSupply',
                recordId: 'supply-1',
                oldData: expect.objectContaining({ stationId: 'station-5', liters: 1000 }),
            }),
        }));
    });
});


describe('station-scoped GAS supply contract', () => {
    it('rejects invalid or reversed date filters before reading rows', async () => {
        const { GET } = await import('../src/app/api/v2/gas/[stationId]/supplies/route');
        for (const query of ['from=bad-date', 'from=2026-08-31&to=2026-08-01']) {
            prismaMock.gasSupply.findMany.mockClear();
            const response = await GET(
                new Request(`http://localhost/api/v2/gas/5/supplies?${query}`) as never,
                { params: Promise.resolve({ stationId: '5' }) }
            );
            expect(response.status).toBe(400);
            expect(prismaMock.gasSupply.findMany).not.toHaveBeenCalled();
        }
    });

    it('rejects malformed JSON before starting a write transaction', async () => {
        const { POST } = await import('../src/app/api/v2/gas/[stationId]/supplies/route');
        const response = await POST(new Request('http://localhost/api/v2/gas/5/supplies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{bad',
        }) as never, { params: Promise.resolve({ stationId: '5' }) });

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates a station supply and its AuditLog inside one bounded transaction', async () => {
        txMock.gasSupply.create.mockResolvedValue(existingSupply);
        txMock.auditLog.create.mockResolvedValue({ id: 'audit-staff-1' });

        const { POST } = await import('../src/app/api/v2/gas/[stationId]/supplies/route');
        const response = await POST(jsonRequest({
            dateKey: '2026-08-30',
            liters: 1000,
            supplier: 'Supplier A',
            invoiceNo: 'INV-1',
            pricePerLiter: 12.5,
        }) as never, { params: Promise.resolve({ stationId: '5' }) });

        expect(response.status).toBe(200);
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 20000 });
        expect(txMock.gasSupply.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ stationId: 'station-5', liters: 1000, totalCost: 12500 }),
        }));
        expect(txMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: 'staff-1',
                action: 'CREATE',
                model: 'GasSupply',
                recordId: 'supply-1',
                newData: expect.objectContaining({ source: 'gas-v2-supplies' }),
            }),
        }));
    });
});
