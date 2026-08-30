import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/api-error';
import { requireAdminApi } from '@/lib/api-auth';
import { getWatcharaDispenserStatus } from '@/lib/watchara-dispenser-sync';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const probe = searchParams.get('probe');
        if (probe !== null && probe !== '0' && probe !== '1') {
            return NextResponse.json({ error: 'probe must be 0 or 1' }, { status: 400 });
        }

        const status = await getWatcharaDispenserStatus({ probeLive: probe === '1' });
        return NextResponse.json(status);
    } catch (error) {
        console.error('[Watchara Dispenser Status GET]:', error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
