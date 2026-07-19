import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const loadTankLoyAutoPrintReportMock = vi.fn();

vi.mock('@/lib/tank-loy-auto-print', () => ({
    getPreviousBangkokDate: vi.fn().mockReturnValue('2026-07-18'),
    loadTankLoyAutoPrintReport: loadTankLoyAutoPrintReportMock,
    validateAutoPrintDate: (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date),
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    loadTankLoyAutoPrintReportMock.mockResolvedValue({
        ready: true,
        jobId: 'station-1:2026-07-18',
        reportDate: '2026-07-18',
        xml: '<epos-print />',
    });
});

describe('Tank Loy auto-print API', () => {
    it('stays disabled until the server token is configured', async () => {
        vi.stubEnv('TANK_LOY_PRINT_AGENT_TOKEN', '');
        const { GET } = await import('../src/app/api/automation/tank-loy/daily-report/route');

        const response = await GET(new NextRequest('http://localhost/api/automation/tank-loy/daily-report'));

        expect(response.status).toBe(503);
    });

    it('rejects a wrong bearer token', async () => {
        vi.stubEnv('TANK_LOY_PRINT_AGENT_TOKEN', 'correct-token');
        const { GET } = await import('../src/app/api/automation/tank-loy/daily-report/route');
        const request = new NextRequest('http://localhost/api/automation/tank-loy/daily-report', {
            headers: { authorization: 'Bearer wrong-token' },
        });

        const response = await GET(request);

        expect(response.status).toBe(401);
        expect(loadTankLoyAutoPrintReportMock).not.toHaveBeenCalled();
    });

    it('returns yesterday report without allowing browser caching', async () => {
        vi.stubEnv('TANK_LOY_PRINT_AGENT_TOKEN', 'correct-token');
        const { GET } = await import('../src/app/api/automation/tank-loy/daily-report/route');
        const request = new NextRequest('http://localhost/api/automation/tank-loy/daily-report', {
            headers: { authorization: 'Bearer correct-token' },
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(body.jobId).toBe('station-1:2026-07-18');
        expect(loadTankLoyAutoPrintReportMock).toHaveBeenCalledWith('2026-07-18');
    });
});
