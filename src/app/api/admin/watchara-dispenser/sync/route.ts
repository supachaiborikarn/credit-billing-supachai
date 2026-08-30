import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/api-error';
import { requireAdminApi } from '@/lib/api-auth';
import { syncWatcharaDispenser } from '@/lib/watchara-dispenser-sync';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }
        const input = body as Record<string, unknown>;
        if (input.startDate !== undefined && typeof input.startDate !== 'string') {
            return NextResponse.json({ error: 'startDate must be YYYY-MM-DD' }, { status: 400 });
        }
        if (input.endDate !== undefined && typeof input.endDate !== 'string') {
            return NextResponse.json({ error: 'endDate must be YYYY-MM-DD' }, { status: 400 });
        }
        if (input.dryRun !== undefined && typeof input.dryRun !== 'boolean') {
            return NextResponse.json({ error: 'dryRun must be boolean' }, { status: 400 });
        }

        const result = await syncWatcharaDispenser({
            startDate: input.startDate as string | undefined,
            endDate: input.endDate as string | undefined,
            dryRun: input.dryRun === true,
            triggeredByUserId: auth.user.id,
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        const message = getErrorMessage(error);
        const status = message.includes('Invalid date format') || message.includes('Date range is too large') || message.includes('endDate must')
            ? 400
            : 500;
        console.error('[Watchara Dispenser Sync POST]:', error);
        return NextResponse.json({ error: message }, { status });
    }
}
