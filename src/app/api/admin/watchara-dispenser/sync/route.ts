import { NextRequest, NextResponse } from 'next/server';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { getSessionWithError, isAdmin } from '@/lib/auth-utils';
import { syncWatcharaDispenser } from '@/lib/watchara-dispenser-sync';

export async function POST(request: NextRequest) {
    try {
        const { user, error } = await getSessionWithError();
        if (!user) {
            return HttpErrors.unauthorized(error || 'Unauthorized');
        }

        if (!isAdmin(user)) {
            return HttpErrors.forbidden('Admin only');
        }

        const body = await request.json().catch(() => ({}));
        const startDate = typeof body.startDate === 'string' ? body.startDate : undefined;
        const endDate = typeof body.endDate === 'string' ? body.endDate : undefined;
        const dryRun = body.dryRun === true;

        const result = await syncWatcharaDispenser({
            startDate,
            endDate,
            dryRun,
            triggeredByUserId: user.id,
        });

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message.includes('Unauthorized')
            ? 401
            : message.includes('Admin only')
                ? 403
                : message.includes('Invalid date format') || message.includes('Date range is too large') || message.includes('endDate must')
                    ? 400
                    : 500;

        console.error('[Watchara Dispenser Sync POST]:', error);
        return NextResponse.json({ error: message }, { status });
    }
}
