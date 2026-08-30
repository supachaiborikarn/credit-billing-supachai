import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const MAX_ALERT_DAYS = 90;
const WRITE_TX_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;

function parseAlertDays(raw: string | null) {
    if (raw === null || raw === '') return { ok: true as const, days: 7 };
    if (!/^\d+$/.test(raw)) return { ok: false as const, error: 'days must be an integer from 1 to 90' };
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > MAX_ALERT_DAYS) {
        return { ok: false as const, error: 'days must be an integer from 1 to 90' };
    }
    return { ok: true as const, days };
}

class AlertActionError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const parsedDays = parseAlertDays(new URL(request.url).searchParams.get('days'));
        if (!parsedDays.ok) return NextResponse.json({ error: parsedDays.error }, { status: 400 });
        const startDate = new Date(Date.now() - parsedDays.days * 24 * 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [varianceAlerts, unlockedShifts, recentAuditLogs] = await Promise.all([
            prisma.shiftReconciliation.findMany({
                where: {
                    varianceStatus: { in: ['YELLOW', 'RED'] },
                    createdAt: { gte: startDate },
                },
                include: {
                    shift: {
                        include: {
                            dailyRecord: {
                                include: { station: { select: { id: true, name: true } } },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            prisma.shift.findMany({
                where: {
                    status: 'CLOSED',
                    closedAt: { lte: twentyFourHoursAgo },
                },
                include: {
                    dailyRecord: { include: { station: { select: { id: true, name: true } } } },
                    staff: { select: { name: true } },
                },
                orderBy: { closedAt: 'desc' },
                take: 20,
            }),
            prisma.auditLog.findMany({
                where: {
                    action: { in: ['DELETE', 'VOID', 'UPDATE', 'LOCK', 'REVIEW'] },
                    createdAt: { gte: startDate },
                },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 30,
            }),
        ]);

        return NextResponse.json({
            alertCounts: {
                varianceAlerts: varianceAlerts.length,
                unlockedShifts: unlockedShifts.length,
                recentChanges: recentAuditLogs.length,
                redVariances: varianceAlerts.filter((item) => item.varianceStatus === 'RED').length,
                yellowVariances: varianceAlerts.filter((item) => item.varianceStatus === 'YELLOW').length,
            },
            varianceAlerts: varianceAlerts.map((item) => ({
                id: item.id,
                shiftId: item.shiftId,
                shiftNumber: item.shift.shiftNumber,
                stationName: item.shift.dailyRecord.station?.name || 'Unknown',
                date: item.shift.dailyRecord.date,
                variance: Number(item.variance),
                varianceStatus: item.varianceStatus,
                totalExpected: Number(item.totalExpected),
                totalReceived: Number(item.totalReceived),
                createdAt: item.createdAt,
            })),
            unlockedShifts: unlockedShifts.map((shift) => ({
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                stationName: shift.dailyRecord.station?.name || 'Unknown',
                date: shift.dailyRecord.date,
                staffName: shift.staff?.name || '-',
                closedAt: shift.closedAt,
                hoursSinceClosed: shift.closedAt
                    ? Math.round((Date.now() - shift.closedAt.getTime()) / (1000 * 60 * 60))
                    : 0,
            })),
            recentAuditLogs: recentAuditLogs.map((log) => ({
                id: log.id,
                action: log.action,
                model: log.model,
                recordId: log.recordId,
                userName: log.user.name,
                oldData: log.oldData,
                newData: log.newData,
                createdAt: log.createdAt,
            })),
        });
    } catch (error) {
        console.error('[Admin Alerts API]:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const { action, shiftId } = body as { action?: unknown; shiftId?: unknown };
        if (action !== 'lock' || typeof shiftId !== 'string' || shiftId.trim() === '') {
            return NextResponse.json({ error: 'Invalid lock action' }, { status: 400 });
        }

        const lockedAt = new Date();
        await prisma.$transaction(async (tx) => {
            const shift = await tx.shift.findUnique({
                where: { id: shiftId },
                select: { status: true, lockedAt: true, lockedById: true },
            });
            if (!shift) throw new AlertActionError(404, 'ไม่พบกะนี้');
            if (shift.status !== 'CLOSED') {
                throw new AlertActionError(409, shift.status === 'LOCKED' ? 'กะนี้ล็อกไปแล้ว' : 'ต้องปิดกะก่อนถึงจะล็อกได้');
            }

            const updated = await tx.shift.updateMany({
                where: { id: shiftId, status: 'CLOSED' },
                data: { status: 'LOCKED', lockedAt, lockedById: auth.user.id },
            });
            if (updated.count !== 1) throw new AlertActionError(409, 'สถานะกะเปลี่ยนแล้ว กรุณารีเฟรช');

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'LOCK',
                    model: 'Shift',
                    recordId: shiftId,
                    oldData: { status: 'CLOSED', lockedAt: shift.lockedAt, lockedById: shift.lockedById },
                    newData: { status: 'LOCKED', lockedAt: lockedAt.toISOString(), lockedById: auth.user.id, source: 'admin-alerts' },
                },
            });
        }, WRITE_TX_OPTIONS);

        return NextResponse.json({ success: true, message: '🔒 ล็อกกะเรียบร้อย' });
    } catch (error) {
        if (error instanceof AlertActionError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Admin Alerts POST]:', error);
        return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
    }
}
