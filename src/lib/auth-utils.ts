/**
 * Authentication Utilities
 * Shared helper functions for session management across API routes
 */

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
    id: string;
    role: 'ADMIN' | 'STAFF';
    name: string;
    stationId: string | null;
}

export interface SessionResult {
    user: SessionUser | null;
    error?: string;
}

/**
 * Get session user from cookies (non-throwing version)
 * Returns null if no valid session
 */
export async function getSessionUser(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) return null;

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    select: { id: true, role: true, name: true, stationId: true }
                }
            }
        });

        if (!session || session.expiresAt < new Date()) return null;

        return {
            id: session.user.id,
            role: session.user.role as 'ADMIN' | 'STAFF',
            name: session.user.name,
            stationId: session.user.stationId,
        };
    } catch (error) {
        console.error('[Auth] Session lookup error:', error);
        return null;
    }
}

/**
 * Get session user with explicit error messages
 * Returns user or error string for API responses
 */
export async function getSessionWithError(): Promise<SessionResult> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
        return { user: null, error: 'กรุณาเข้าสู่ระบบ' };
    }

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    select: { id: true, role: true, name: true, stationId: true }
                }
            }
        });

        if (!session) {
            return { user: null, error: 'Session ไม่ถูกต้อง' };
        }

        if (session.expiresAt < new Date()) {
            return { user: null, error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' };
        }

        return {
            user: {
                id: session.user.id,
                role: session.user.role as 'ADMIN' | 'STAFF',
                name: session.user.name,
                stationId: session.user.stationId,
            }
        };
    } catch (error) {
        console.error('[Auth] Session lookup error:', error);
        return { user: null, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' };
    }
}

/**
 * Require valid session (throwing version)
 * Use in API routes with try/catch
 */
export async function requireSession(): Promise<SessionUser> {
    const result = await getSessionWithError();
    if (!result.user) {
        throw new Error(result.error || 'Unauthorized');
    }
    return result.user;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: SessionUser | null): boolean {
    return user?.role === 'ADMIN';
}

/**
 * Check if user can access station
 */
export function canAccessStation(user: SessionUser | null, stationId: string): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.stationId === stationId;
}
