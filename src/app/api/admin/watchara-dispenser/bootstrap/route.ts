import { NextRequest, NextResponse } from 'next/server';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { getSessionWithError, isAdmin } from '@/lib/auth-utils';
import { ensureWatcharaSalesSource } from '@/lib/watchara-dispenser-sync';

export async function POST(_request: NextRequest) {
    try {
        const { user, error } = await getSessionWithError();
        if (!user) {
            return HttpErrors.unauthorized(error || 'Unauthorized');
        }

        if (!isAdmin(user)) {
            return HttpErrors.forbidden('Admin only');
        }

        const source = await ensureWatcharaSalesSource();

        return NextResponse.json({
            success: true,
            source: {
                id: source.id,
                code: source.code,
                name: source.name,
                stationId: source.stationId,
                sourceStationRef: source.sourceStationRef,
                fuelFamily: source.fuelFamily,
                rollupMode: source.rollupMode,
                isEnabled: source.isEnabled,
                lastSyncAttemptAt: source.lastSyncAttemptAt?.toISOString() || null,
                lastSyncedAt: source.lastSyncedAt?.toISOString() || null,
                lastSeenSourceAt: source.lastSeenSourceAt?.toISOString() || null,
                lastError: source.lastError,
            },
        });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message.includes('Target station')
            ? 400
            : 500;

        console.error('[Watchara Dispenser Bootstrap POST]:', error);
        return NextResponse.json({ error: message }, { status });
    }
}
