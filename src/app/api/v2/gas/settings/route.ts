import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Default settings
const DEFAULT_SETTINGS: Record<string, string> = {
    gasPrice: '16.09',
    tankCapacity: '2400',
    tankCount: '3',
    alertLowGauge: '20',
    alertCriticalGauge: '10'
};

/**
 * GET /api/v2/gas/settings
 * Get all gas settings or specific key
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (key) {
            // Get specific setting
            const setting = await prisma.gasSettings.findUnique({
                where: { key }
            });

            if (!setting) {
                // Return default if exists
                if (DEFAULT_SETTINGS[key]) {
                    return NextResponse.json({
                        key,
                        value: DEFAULT_SETTINGS[key],
                        isDefault: true
                    });
                }
                return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
            }

            return NextResponse.json({
                key: setting.key,
                value: setting.value,
                updatedAt: setting.updatedAt
            });
        }

        // Get all settings
        const settings = await prisma.gasSettings.findMany();

        // Merge with defaults
        const result: Record<string, { value: string; isDefault: boolean; updatedAt?: Date }> = {};

        // Add defaults first
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            result[k] = { value: v, isDefault: true };
        }

        // Override with database values
        for (const s of settings) {
            result[s.key] = {
                value: s.value,
                isDefault: false,
                updatedAt: s.updatedAt
            };
        }

        return NextResponse.json({ settings: result });
    } catch (error) {
        console.error('[Gas Settings GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

/**
 * POST /api/v2/gas/settings
 * Update gas settings (Admin only)
 */
export async function POST(request: NextRequest) {
    try {
        // Verify admin session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
        }

        // Validate known keys
        const validKeys = Object.keys(DEFAULT_SETTINGS);
        if (!validKeys.includes(key)) {
            return NextResponse.json({
                error: `Invalid key. Valid keys: ${validKeys.join(', ')}`
            }, { status: 400 });
        }

        // Validate value type (numeric for all current settings)
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            return NextResponse.json({ error: 'Value must be a positive number' }, { status: 400 });
        }

        // Upsert setting
        const setting = await prisma.gasSettings.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        });

        return NextResponse.json({
            key: setting.key,
            value: setting.value,
            updatedAt: setting.updatedAt,
            message: 'Setting updated successfully'
        });
    } catch (error) {
        console.error('[Gas Settings POST]:', error);
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }
}
