import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireApiSessionMock = vi.fn();
const requireStationAccessApiMock = vi.fn();
const prismaMock = {
    station: { upsert: vi.fn() },
    dailyRecord: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    shift: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    meterReading: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({
    requireApiSession: requireApiSessionMock,
    requireStationAccessApi: requireStationAccessApiMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue({
        user: { id: 'staff-1', name: 'พนักงานแท๊งลอย', role: 'STAFF', stationId: 'station-1' },
    });
    requireStationAccessApiMock.mockResolvedValue({
        user: { id: 'staff-1', name: 'พนักงานแท๊งลอย', role: 'STAFF', stationId: 'station-1' },
    });
    prismaMock.station.upsert.mockResolvedValue({ id: 'station-1' });
    prismaMock.shift.create.mockResolvedValue({
        id: 'today-open',
        shiftNumber: 1,
        status: 'OPEN',
        staff: { name: 'พนักงานแท๊งลอย' },
        createdAt: new Date('2026-09-04T01:00:00.000Z'),
    });
    prismaMock.meterReading.findMany.mockResolvedValue([]);
});

describe('Tank Loy stale shift recovery', () => {
    it('does not resurface older legacy OPEN rows after the latest prior day is closed', async () => {
        prismaMock.dailyRecord.findFirst.mockResolvedValue({
            id: 'latest-prior-record',
            date: new Date('2026-09-02T17:00:00.000Z'),
            shifts: [],
        });

        const { findLatestPriorOpenFullShift } = await import('../src/lib/full-station-stale-shift');
        await expect(findLatestPriorOpenFullShift(
            'station-1',
            new Date('2026-09-03T17:00:00.000Z')
        )).resolves.toBeNull();
    });

    it('blocks a new shift by the old business date even when the old row was created today', async () => {
        prismaMock.dailyRecord.findFirst.mockImplementation(async (args: { orderBy?: { date?: string } }) => (
            args.orderBy?.date === 'desc'
                ? {
                    id: 'yesterday-record',
                    date: new Date('2026-09-02T17:00:00.000Z'),
                    shifts: [{
                        id: 'yesterday-open',
                        shiftNumber: 1,
                        status: 'OPEN',
                        createdAt: new Date('2026-09-04T00:10:00.000Z'),
                        staff: { name: 'พนักงานเมื่อวาน' },
                        meters: [],
                        _count: { transactions: 0 },
                    }],
                }
                : { id: 'today-record', shifts: [] }
        ));

        const { POST } = await import('../src/app/api/station/[id]/shifts/route');
        const response = await POST(new Request('http://localhost/api/station/1/shifts', {
            method: 'POST',
            body: JSON.stringify({ action: 'open' }),
        }), { params: Promise.resolve({ id: '1' }) });
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toMatchObject({
            requiresCloseOldShift: true,
            oldShift: { id: 'yesterday-open' },
        });
        expect(prismaMock.shift.create).not.toHaveBeenCalled();
    });

    it('returns the old OPEN shift beside today shift so Operations can close it', async () => {
        prismaMock.dailyRecord.findFirst
            .mockResolvedValueOnce({
                id: 'today-record',
                date: new Date('2026-09-03T17:00:00.000Z'),
                shifts: [{
                    id: 'today-open',
                    shiftNumber: 1,
                    status: 'OPEN',
                    createdAt: new Date('2026-09-04T01:00:00.000Z'),
                    closedAt: null,
                    staff: { name: 'พนักงานวันนี้' },
                    meters: [],
                    _count: { transactions: 0 },
                }],
            })
            .mockResolvedValueOnce({
                id: 'yesterday-record',
                date: new Date('2026-09-02T17:00:00.000Z'),
                shifts: [{
                    id: 'yesterday-open',
                    shiftNumber: 1,
                    status: 'OPEN',
                    createdAt: new Date('2026-09-03T01:00:00.000Z'),
                    closedAt: null,
                    staff: { name: 'พนักงานเมื่อวาน' },
                    meters: [],
                    _count: { transactions: 0 },
                }],
            })
            .mockResolvedValueOnce({ retailPrice: 31.5, wholesalePrice: 30.5 });

        const { GET } = await import('../src/app/api/stations/[stationId]/context/route');
        const response = await GET(new Request('http://localhost/api/stations/station-1/context'), {
            params: Promise.resolve({ stationId: 'station-1' }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.currentShift).toMatchObject({ id: 'today-open' });
        expect(payload.staleShift).toMatchObject({
            id: 'yesterday-open',
            status: 'OPEN',
            staffName: 'พนักงานเมื่อวาน',
        });
    });
});
