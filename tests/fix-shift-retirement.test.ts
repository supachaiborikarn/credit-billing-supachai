import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/api-auth', () => ({ requireAdminApi: requireAdminApiMock }));

beforeEach(() => {
    requireAdminApiMock.mockReset();
    requireAdminApiMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', stationId: null } });
});

describe('retired temporary fix-shift API', () => {
    it('checks ADMIN auth before returning retirement metadata', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 }),
        });
        const { POST } = await import('../src/app/api/admin/fix-shift/route');
        const response = await POST(new Request('http://localhost/api/admin/fix-shift', {
            method: 'POST',
            body: JSON.stringify({ action: 'force-close', shiftId: 'shift-1' }),
        }));
        expect(response.status).toBe(403);
    });

    it('returns 410 for authenticated callers and points to audited workflows', async () => {
        const { POST } = await import('../src/app/api/admin/fix-shift/route');
        const response = await POST(new Request('http://localhost/api/admin/fix-shift', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', shiftId: 'shift-1' }),
        }));
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Temporary fix-shift API retired',
            retired: true,
            replacements: {
                gasStaleShiftCleanup: '/admin/gas/operations',
                antiFraudReview: '/admin/alerts',
                canonicalOperations: '/stations/[stationId]/operations',
            },
        });
    });

    it('contains no direct Prisma or destructive shift mutation implementation', () => {
        const source = readFileSync('src/app/api/admin/fix-shift/route.ts', 'utf8');
        expect(source).not.toContain("@/lib/prisma");
        expect(source).not.toContain("prisma.shift.update");
        expect(source).not.toContain("prisma.shift.delete");
        expect(source).not.toContain("prisma.dailyRecord.update");
        expect(source).not.toContain("action === 'force-close'");
        expect(source).not.toContain("action === 'update-number'");
        expect(source).toContain('requireAdminApi');
    });
});
