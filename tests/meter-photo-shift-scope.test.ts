import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloudinaryUploadMock = vi.fn();
const prismaMock = {
    dailyRecord: {
        upsert: vi.fn(),
    },
    shift: {
        findFirst: vi.fn(),
    },
    meterReading: {
        upsert: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
};
const requireApiSessionMock = vi.fn();
const ensureOpenShiftMock = vi.fn();

vi.mock('cloudinary', () => ({
    v2: {
        config: vi.fn(),
        uploader: { upload: cloudinaryUploadMock },
    },
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/api-auth', () => ({ requireApiSession: requireApiSessionMock }));
vi.mock('@/lib/auth-utils', () => ({ canAccessStation: vi.fn().mockReturnValue(true) }));
vi.mock('@/lib/full-station-shift-sync', () => ({
    ensureOpenFullStationShiftForDailyRecord: ensureOpenShiftMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    requireApiSessionMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
    cloudinaryUploadMock.mockResolvedValue({
        secure_url: 'https://example.test/end-1.webp',
        public_id: 'meter/end-1',
    });
    prismaMock.dailyRecord.upsert.mockResolvedValue({ id: 'daily-1' });
    prismaMock.shift.findFirst.mockResolvedValue({
        id: 'closed-shift-2',
        dailyRecordId: 'daily-1',
        status: 'CLOSED',
    });
    prismaMock.meterReading.upsert.mockResolvedValue({ id: 'meter-1' });
});

describe('meter photo shift scope', () => {
    it('returns a unique shift-scoped URL without changing meter rows before final save', async () => {
        const formData = new FormData();
        formData.append('file', new File(['image'], 'meter.jpg', { type: 'image/jpeg' }));
        formData.append('type', 'end');
        formData.append('nozzle', '1');
        formData.append('date', '2026-07-10');
        formData.append('stationId', 'station-1');
        formData.append('shiftId', 'closed-shift-2');

        const { POST } = await import('../src/app/api/upload/meter-photo/route');
        const response = await POST(new Request('http://localhost/api/upload/meter-photo', {
            method: 'POST',
            body: formData,
        }) as never);

        expect(response.status).toBe(200);
        expect(ensureOpenShiftMock).not.toHaveBeenCalled();
        expect(cloudinaryUploadMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                public_id: expect.stringMatching(/^meters\/station-1\/2026-07-10\/closed-shift-2\/nozzle1_end_\d+$/),
                overwrite: false,
            })
        );
        expect(prismaMock.dailyRecord.upsert).not.toHaveBeenCalled();
        expect(prismaMock.meterReading.upsert).not.toHaveBeenCalled();
    });
});
