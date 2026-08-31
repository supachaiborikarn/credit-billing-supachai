import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    gaugeReading: { findMany: vi.fn() },
    shift: { findUnique: vi.fn() },
    meterReading: { upsert: vi.fn() },
};
const requireStationAccessApiMock = vi.fn();
const requireGasStationAccessMock = vi.fn();
const shiftBelongsToStationMock = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireStationAccessApi: requireStationAccessApiMock }));
vi.mock('@/lib/gas/api-guards', () => ({
    requireGasStationAccess: requireGasStationAccessMock,
    shiftBelongsToStation: shiftBelongsToStationMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireStationAccessApiMock.mockResolvedValue({ response: null, user: { id: 'staff-1', role: 'STAFF' } });
    requireGasStationAccessMock.mockResolvedValue({
        response: null,
        user: { id: 'staff-5', role: 'STAFF' },
        station: { id: 'station-5', dbId: 'station-5', index: 5, name: 'Gas 5', type: 'GAS' },
    });
    shiftBelongsToStationMock.mockReturnValue(true);
});

describe('S135 legacy operational write retirement', () => {
    it('retires station shift-meter POST after station auth', async () => {
        const { POST } = await import('../src/app/api/station/[id]/shift-meters/route');
        const response = await POST(new Request('http://localhost/api/station/1/shift-meters', { method: 'POST' }) as never, {
            params: Promise.resolve({ id: '1' }),
        });
        expect(response.status).toBe(410);
        expect(requireStationAccessApiMock).toHaveBeenCalledWith('station-1');
        expect(prismaMock.meterReading.upsert).not.toHaveBeenCalled();
    });

    it('retires legacy GAS gauge POST after GAS station auth', async () => {
        const { POST } = await import('../src/app/api/gas-station/[id]/gauge/route');
        const response = await POST(new Request('http://localhost/api/gas-station/5/gauge', { method: 'POST' }), {
            params: Promise.resolve({ id: '5' }),
        });
        expect(response.status).toBe(410);
        expect(requireGasStationAccessMock).toHaveBeenCalledWith('5');
        await expect(response.json()).resolves.toMatchObject({
            canonicalOperations: '/stations/station-5/operations',
            canonicalGaugeApi: '/api/v2/gas/5/gauge',
        });
    });

    it('keeps legacy GAS gauge GET read-only and station-scoped', async () => {
        prismaMock.gaugeReading.findMany.mockResolvedValue([
            { tankNumber: 1, percentage: 40, photoUrl: 'start.jpg', notes: 'start', createdAt: new Date('2026-08-31T01:00:00Z') },
            { tankNumber: 1, percentage: 35, photoUrl: 'end.jpg', notes: 'end', createdAt: new Date('2026-08-31T02:00:00Z') },
        ]);
        const { GET } = await import('../src/app/api/gas-station/[id]/gauge/route');
        const response = await GET(new Request('http://localhost/api/gas-station/5/gauge?date=2026-08-31&shift=1'), {
            params: Promise.resolve({ id: '5' }),
        });
        expect(response.status).toBe(200);
        expect(prismaMock.gaugeReading.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ stationId: 'station-5', shiftNumber: 1 }),
        }));
        await expect(response.json()).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ tankNumber: 1, startPercentage: 40, endPercentage: 35 }),
        ]));
    });

    it('rejects impossible gauge dates before querying readings', async () => {
        const { GET } = await import('../src/app/api/gas-station/[id]/gauge/route');
        const response = await GET(new Request('http://localhost/api/gas-station/5/gauge?date=2026-02-31'), {
            params: Promise.resolve({ id: '5' }),
        });
        expect(response.status).toBe(400);
        expect(prismaMock.gaugeReading.findMany).not.toHaveBeenCalled();
    });

    it('retires legacy GAS shift-detail PUT before reading or mutating the shift', async () => {
        const { PUT } = await import('../src/app/api/gas-station/[id]/shifts/[shiftId]/route');
        const response = await PUT(new Request('http://localhost/api/gas-station/5/shifts/shift-1', { method: 'PUT' }) as never, {
            params: Promise.resolve({ id: '5', shiftId: 'shift-1' }),
        });
        expect(response.status).toBe(410);
        expect(requireGasStationAccessMock).toHaveBeenCalledWith('5');
        expect(prismaMock.shift.findUnique).not.toHaveBeenCalled();
    });

    it('station-binds legacy GAS shift-detail GET', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-foreign', shiftNumber: 1, status: 'OPEN', createdAt: new Date(), closedAt: null,
            staff: null, meters: [], dailyRecord: { stationId: 'station-6' },
        });
        shiftBelongsToStationMock.mockReturnValue(false);
        const { GET } = await import('../src/app/api/gas-station/[id]/shifts/[shiftId]/route');
        const response = await GET(new Request('http://localhost/api/gas-station/5/shifts/shift-foreign') as never, {
            params: Promise.resolve({ id: '5', shiftId: 'shift-foreign' }),
        });
        expect(response.status).toBe(404);
        expect(requireGasStationAccessMock).toHaveBeenCalledWith('5');
    });

    it('removes old mutation implementations from active route sources', () => {
        const shiftMeters = readFileSync('src/app/api/station/[id]/shift-meters/route.ts', 'utf8');
        expect(shiftMeters).not.toContain('meterReading.upsert');

        const gauge = readFileSync('src/app/api/gas-station/[id]/gauge/route.ts', 'utf8');
        expect(gauge).not.toContain('station.upsert');
        expect(gauge).not.toContain('gaugeReading.deleteMany');
        expect(gauge).not.toContain('gaugeReading.create');

        const shiftDetail = readFileSync('src/app/api/gas-station/[id]/shifts/[shiftId]/route.ts', 'utf8');
        expect(shiftDetail).not.toContain('createNextShiftWithCarryOver');
        expect(shiftDetail).not.toContain('meterReading.updateMany');
        expect(shiftDetail).not.toContain('shift.update');
    });
});
