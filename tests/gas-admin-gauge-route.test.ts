import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminApiMock = vi.fn();
const prismaMock = {
    gaugeReading: {
        findMany: vi.fn(),
    },
};

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    prismaMock.gaugeReading.findMany.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    prismaMock.gaugeReading.findMany.mockResolvedValue([]);
});

describe('GAS admin gauge history route', () => {
    it('uses the shared ADMIN guard before reading gauge history', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { GET } = await import('../src/app/api/v2/gas/admin/gauge/route');
        const response = await GET(new Request('http://localhost/api/v2/gas/admin/gauge') as never);
        expect(response.status).toBe(403);
        expect(prismaMock.gaugeReading.findMany).not.toHaveBeenCalled();
    });

    it.each([
        ['from=bad-date', 'รูปแบบวันที่ไม่ถูกต้อง'],
        ['from=2026-08-31&to=2026-08-30', 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด'],
        ['stationId=station-1', 'Invalid gas station'],
        ['tank=1x', 'tank must be 1, 2 or 3'],
    ])('fails closed for invalid filter %s', async (query, error) => {
        const { GET } = await import('../src/app/api/v2/gas/admin/gauge/route');
        const response = await GET(new Request(`http://localhost/api/v2/gas/admin/gauge?${query}`) as never);
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error });
        expect(prismaMock.gaugeReading.findMany).not.toHaveBeenCalled();
    });

    it('queries Bangkok day bounds and serializes the reading date in Bangkok', async () => {
        prismaMock.gaugeReading.findMany.mockResolvedValue([{
            id: 'gauge-1',
            stationId: 'station-5',
            date: new Date('2026-08-29T17:00:00.000Z'),
            shiftNumber: 2,
            tankNumber: 2,
            percentage: 42.5,
            notes: 'end',
            createdAt: new Date('2026-08-30T00:30:00.000Z'),
        }]);

        const { GET } = await import('../src/app/api/v2/gas/admin/gauge/route');
        const response = await GET(new Request(
            'http://localhost/api/v2/gas/admin/gauge?from=2026-08-30&to=2026-08-30&stationId=station-5&tank=2'
        ) as never);

        expect(response.status).toBe(200);
        expect(prismaMock.gaugeReading.findMany).toHaveBeenCalledWith({
            where: {
                stationId: { in: ['station-5'] },
                date: {
                    gte: new Date('2026-08-29T17:00:00.000Z'),
                    lte: new Date('2026-08-30T16:59:59.999Z'),
                },
                tankNumber: 2,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        await expect(response.json()).resolves.toMatchObject({
            readings: [{
                id: 'gauge-1',
                date: '2026-08-30',
                stationId: 'station-5',
                tankNumber: 2,
                percentage: 42.5,
                notes: 'end',
            }],
            filters: { from: '2026-08-30', to: '2026-08-30' },
        });
    });
});
