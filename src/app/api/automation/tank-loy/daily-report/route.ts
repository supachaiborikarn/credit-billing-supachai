import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
    getPreviousBangkokDate,
    loadTankLoyAutoPrintReport,
    validateAutoPrintDate,
} from '@/lib/tank-loy-auto-print';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function tokensMatch(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function authorizePrintAgent(request: NextRequest): NextResponse | null {
    const configuredToken = process.env.TANK_LOY_PRINT_AGENT_TOKEN?.trim();
    if (!configuredToken) {
        return NextResponse.json(
            { error: 'Print agent is not configured' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    const authorization = request.headers.get('authorization') || '';
    const receivedToken = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

    if (!receivedToken || !tokensMatch(receivedToken, configuredToken)) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    return null;
}

export async function GET(request: NextRequest) {
    const authError = authorizePrintAgent(request);
    if (authError) return authError;

    const reportDate = request.nextUrl.searchParams.get('date') || getPreviousBangkokDate();
    if (!validateAutoPrintDate(reportDate)) {
        return NextResponse.json(
            { error: 'Invalid date. Use YYYY-MM-DD.' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
    }

    try {
        const report = await loadTankLoyAutoPrintReport(reportDate);
        return NextResponse.json(report, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (error) {
        console.error('[Tank Loy Auto Print]:', error);
        return NextResponse.json(
            { error: 'Failed to build daily report' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
