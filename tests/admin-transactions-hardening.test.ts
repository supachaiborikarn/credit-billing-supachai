import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const prismaMock = {
    transaction: { findMany: vi.fn() },
};
const buildTruckCodeMapMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/truck-utils', () => ({
    buildTruckCodeMap: buildTruckCodeMapMock,
    findCodeByPlate: vi.fn(() => null),
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiMock.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
    prismaMock.transaction.findMany.mockResolvedValue([]);
    buildTruckCodeMapMock.mockResolvedValue(new Map());
});

describe('S108 global admin transaction maintenance hardening', () => {
    it('uses the shared ADMIN auth guard before reading transactions', async () => {
        requireAdminApiMock.mockResolvedValueOnce({ response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) });
        const { GET } = await import('../src/app/api/admin/transactions/route');
        const response = await GET(new Request('http://localhost/api/admin/transactions?date=2026-08-30') as never);
        expect(response.status).toBe(401);
        expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    });

    it('fails closed for malformed dates and unknown stations', async () => {
        const { GET } = await import('../src/app/api/admin/transactions/route');
        const badDate = await GET(new Request('http://localhost/api/admin/transactions?date=30-08-2026') as never);
        expect(badDate.status).toBe(400);
        const badStation = await GET(new Request('http://localhost/api/admin/transactions?date=2026-08-30&stationId=station-999') as never);
        expect(badStation.status).toBe(400);
        expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    });

    it('normalizes a valid station and Bangkok day into the query', async () => {
        const { GET } = await import('../src/app/api/admin/transactions/route');
        const response = await GET(new Request('http://localhost/api/admin/transactions?date=2026-08-30&stationId=station-5&includeVoided=true') as never);
        expect(response.status).toBe(200);
        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                stationId: 'station-5',
                date: {
                    gte: new Date('2026-08-29T17:00:00.000Z'),
                    lte: new Date('2026-08-30T16:59:59.999Z'),
                },
            }),
        }));
    });

    it('requires an edit reason in the global UI and carries it into transaction AuditLog', () => {
        const page = readFileSync('src/app/admin/transactions/page.tsx', 'utf8');
        const route = readFileSync('src/app/api/station/[id]/transactions/[transactionId]/route.ts', 'utf8');
        expect(page).toContain("const [editReason, setEditReason] = useState('')");
        expect(page).toContain('auditReason: reason');
        expect(page).toContain('editReason.trim().length < 3');
        expect(route).toContain('auditReason: typeof auditReason');
        expect(route).toContain("auditReason.trim().slice(0, 200)");
    });

    it('requires a 3-200 character void reason in the global UI', () => {
        const page = readFileSync('src/app/admin/transactions/page.tsx', 'utf8');
        expect(page).toContain('const reason = voidReason.trim()');
        expect(page).toContain('reason.length < 3 || reason.length > 200');
        expect(page).toContain('body: JSON.stringify({ reason })');
        expect(page).toContain('maxLength={200}');
        expect(page).toContain("setVoidReason('')");
    });
});
