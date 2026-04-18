import { NextResponse } from 'next/server';
import {
    canAccessStation,
    getSessionWithError,
    isAdmin,
    type SessionUser,
} from '@/lib/auth-utils';

type ApiAuthSuccess = { user: SessionUser; response?: never };
type ApiAuthFailure = { user?: never; response: NextResponse };
export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

export async function requireApiSession(): Promise<ApiAuthResult> {
    const { user, error } = await getSessionWithError();

    if (!user) {
        return {
            response: NextResponse.json(
                { error: error || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    return { user };
}

export async function requireAdminApi(): Promise<ApiAuthResult> {
    const auth = await requireApiSession();
    if (auth.response) return auth;

    if (!isAdmin(auth.user)) {
        return {
            response: NextResponse.json(
                { error: 'Admin only' },
                { status: 403 }
            ),
        };
    }

    return auth;
}

export async function requireStationAccessApi(stationId: string): Promise<ApiAuthResult> {
    const auth = await requireApiSession();
    if (auth.response) return auth;

    if (!canAccessStation(auth.user, stationId)) {
        return {
            response: NextResponse.json(
                { error: 'ไม่มีสิทธิ์เข้าถึงสถานีนี้' },
                { status: 403 }
            ),
        };
    }

    return auth;
}
