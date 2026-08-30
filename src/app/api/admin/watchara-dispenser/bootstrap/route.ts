import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/api-error';
import { requireAdminApi } from '@/lib/api-auth';
import { bootstrapWatcharaSalesSource } from '@/lib/watchara-dispenser-sync';

export async function POST() {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const source = await bootstrapWatcharaSalesSource(auth.user.id);
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
        const status = message.includes('Target station') ? 400 : 500;
        console.error('[Watchara Dispenser Bootstrap POST]:', error);
        return NextResponse.json({ error: message }, { status });
    }
}
