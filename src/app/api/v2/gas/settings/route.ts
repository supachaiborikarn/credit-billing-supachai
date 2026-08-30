import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_GAS_PRICE } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';

const FALLBACK_KEY = 'gasPrice';

function serializeSetting(setting: { key: string; value: string; updatedAt: Date } | null) {
    if (!setting) {
        return { key: FALLBACK_KEY, value: String(DEFAULT_GAS_PRICE), isDefault: true };
    }
    return { key: setting.key, value: setting.value, isDefault: false, updatedAt: setting.updatedAt };
}

/** Global GAS fallback only. Runtime price priority is DailyRecord -> Station -> this fallback. */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const key = new URL(request.url).searchParams.get('key');
        if (key && key !== FALLBACK_KEY) {
            return NextResponse.json({ error: 'Setting key is no longer supported' }, { status: 404 });
        }

        const setting = await prisma.gasSettings.findUnique({ where: { key: FALLBACK_KEY } });
        const item = serializeSetting(setting);
        if (key === FALLBACK_KEY) return NextResponse.json(item);
        return NextResponse.json({ settings: { [FALLBACK_KEY]: item } });
    } catch (error) {
        console.error('[Gas Settings GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch GAS fallback price' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null) as { key?: unknown; value?: unknown } | null;
        const key = typeof body?.key === 'string' ? body.key.trim() : '';
        if (key !== FALLBACK_KEY) {
            return NextResponse.json({ error: 'แก้ได้เฉพาะราคา fallback ของ GAS' }, { status: 400 });
        }

        const value = Number(body?.value);
        if (!Number.isFinite(value) || value <= 0 || value > 1000) {
            return NextResponse.json({ error: 'ราคา fallback ต้องมากกว่า 0 และไม่เกิน 1,000 บาท/ลิตร' }, { status: 400 });
        }
        const normalizedValue = value.toFixed(2);

        const result = await prisma.$transaction(async (tx) => {
            const previous = await tx.gasSettings.findUnique({ where: { key: FALLBACK_KEY } });
            const setting = await tx.gasSettings.upsert({
                where: { key: FALLBACK_KEY },
                update: { value: normalizedValue },
                create: { key: FALLBACK_KEY, value: normalizedValue },
            });

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: previous ? 'UPDATE' : 'CREATE',
                    model: 'GasSettings',
                    recordId: setting.id,
                    oldData: previous ? { key: FALLBACK_KEY, value: previous.value } : undefined,
                    newData: {
                        key: FALLBACK_KEY,
                        value: normalizedValue,
                        source: 'gas-global-fallback-price',
                        priority: 'after-daily-and-station-price',
                    },
                },
            });

            return setting;
        }, { maxWait: 5_000, timeout: 20_000 });

        return NextResponse.json({
            ...serializeSetting(result),
            message: 'บันทึกราคา fallback แล้ว',
        });
    } catch (error) {
        console.error('[Gas Settings POST]:', error);
        return NextResponse.json({ error: 'Failed to update GAS fallback price' }, { status: 500 });
    }
}
