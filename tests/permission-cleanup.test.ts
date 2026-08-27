import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireAdminApiMock } = vi.hoisted(() => ({
    requireAdminApiMock: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {},
}));

import { GET as getDashboard } from '@/app/api/dashboard/route';
import { POST as createUser } from '@/app/api/users/route';
import { PUT as updateUser } from '@/app/api/users/[id]/route';
import { isUserRole } from '@/constants/user-roles';

describe('permission cleanup', () => {
    beforeEach(() => {
        requireAdminApiMock.mockReset();
    });

    it('keeps the runtime role model limited to ADMIN and STAFF', () => {
        expect(isUserRole('ADMIN')).toBe(true);
        expect(isUserRole('STAFF')).toBe(true);
        expect(isUserRole('MANAGER')).toBe(false);
        expect(isUserRole('OWNER')).toBe(false);
        expect(isUserRole('PURCHASE')).toBe(false);
    });

    it('blocks dashboard data before touching dashboard queries when user is not admin', async () => {
        requireAdminApiMock.mockResolvedValue({
            response: NextResponse.json({ error: 'Admin only' }, { status: 403 }),
        });

        const response = await getDashboard(new Request('http://localhost/api/dashboard?date=2026-08-27'));

        expect(response.status).toBe(403);
        expect(requireAdminApiMock).toHaveBeenCalledTimes(1);
    });

    it('rejects an unsupported role when creating a user', async () => {
        requireAdminApiMock.mockResolvedValue({
            user: { id: 'admin-1', name: 'Admin', role: 'ADMIN', stationId: null },
        });

        const request = new NextRequest('http://localhost/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'manager-test',
                password: 'test-password',
                fullName: 'Manager Test',
                role: 'MANAGER',
            }),
        });

        const response = await createUser(request);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toBe('บทบาทผู้ใช้ไม่ถูกต้อง');
    });

    it('rejects an unsupported role when updating a user', async () => {
        requireAdminApiMock.mockResolvedValue({
            user: { id: 'admin-1', name: 'Admin', role: 'ADMIN', stationId: null },
        });

        const request = new NextRequest('http://localhost/api/users/user-1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: 'User One', role: 'OWNER' }),
        });

        const response = await updateUser(request, {
            params: Promise.resolve({ id: 'user-1' }),
        });
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toBe('บทบาทผู้ใช้ไม่ถูกต้อง');
    });
});
