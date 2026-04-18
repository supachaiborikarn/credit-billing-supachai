import { NextRequest, NextResponse } from 'next/server';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { getSessionWithError, isAdmin } from '@/lib/auth-utils';
import { getWatcharaDispenserStatus } from '@/lib/watchara-dispenser-sync';

export async function GET(request: NextRequest) {
    try {
        const { user, error } = await getSessionWithError();
        if (!user) {
            return HttpErrors.unauthorized(error || 'Unauthorized');
        }

        if (!isAdmin(user)) {
            return HttpErrors.forbidden('Admin only');
        }

        const { searchParams } = new URL(request.url);
        const probeLive = searchParams.get('probe') === '1';
        const status = await getWatcharaDispenserStatus({ probeLive });

        return NextResponse.json(status);
    } catch (error) {
        console.error('[Watchara Dispenser Status GET]:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
