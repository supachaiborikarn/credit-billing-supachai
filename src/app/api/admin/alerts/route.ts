import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Admin Alert Dashboard API
export async function GET(request: NextRequest) {
    try {
        // Check admin role
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
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // 1. Variance Alerts (YELLOW/RED)
        const varianceAlerts = await prisma.shiftReconciliation.findMany({
            where: {
                varianceStatus: { in: ['YELLOW', 'RED'] },
                createdAt: { gte: startDate }
            },
            include: {
                shift: {
                    include: {
                        dailyRecord: {
                            include: {
                                station: { select: { id: true, name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // 2. Unlocked Shifts (CLOSED but not LOCKED for more than 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const unlockedShifts = await prisma.shift.findMany({
            where: {
                status: 'CLOSED',
                closedAt: { lte: twentyFourHoursAgo }
            },
            include: {
                dailyRecord: {
                    include: {
                        station: { select: { id: true, name: true } }
                    }
                },
                staff: { select: { name: true } }
            },
            orderBy: { closedAt: 'desc' },
            take: 20
        });

        // 3. Recent Audit Logs
        const recentAuditLogs = await prisma.auditLog.findMany({
            where: {
                action: { in: ['DELETE', 'VOID', 'UPDATE'] },
                createdAt: { gte: startDate }
            },
            include: {
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 30
        });

        // 4. Summary counts
        const alertCounts = {
            varianceAlerts: varianceAlerts.length,
            unlockedShifts: unlockedShifts.length,
            recentChanges: recentAuditLogs.length,
            redVariances: varianceAlerts.filter(v => v.varianceStatus === 'RED').length,
            yellowVariances: varianceAlerts.filter(v => v.varianceStatus === 'YELLOW').length,
        };

        return NextResponse.json({
            alertCounts,
            varianceAlerts: varianceAlerts.map(v => ({
                id: v.id,
                shiftId: v.shiftId,
                shiftNumber: v.shift.shiftNumber,
                stationName: v.shift.dailyRecord.station?.name || 'Unknown',
                date: v.shift.dailyRecord.date,
                variance: Number(v.variance),
                varianceStatus: v.varianceStatus,
                totalExpected: Number(v.totalExpected),
                totalReceived: Number(v.totalReceived),
                createdAt: v.createdAt
            })),
            unlockedShifts: unlockedShifts.map(s => ({
                id: s.id,
                shiftNumber: s.shiftNumber,
                stationName: s.dailyRecord.station?.name || 'Unknown',
                date: s.dailyRecord.date,
                staffName: s.staff?.name || '-',
                closedAt: s.closedAt,
                hoursSinceClosed: s.closedAt
                    ? Math.round((Date.now() - new Date(s.closedAt).getTime()) / (1000 * 60 * 60))
                    : 0
            })),
            recentAuditLogs: recentAuditLogs.map(log => ({
                id: log.id,
                action: log.action,
                model: log.model,
                recordId: log.recordId,
                userName: log.user.name,
                oldData: log.oldData,
                newData: log.newData,
                createdAt: log.createdAt
            }))
        });
    } catch (error) {
        console.error('[Admin Alerts API]:', error);
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}

// POST - Lock a shift
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { id: true, role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        const body = await request.json();
        const { action, shiftId } = body;

        if (action === 'lock' && shiftId) {
            const shift = await prisma.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'LOCKED',
                    lockedAt: new Date(),
                    lockedById: session.user.id
                }
            });

            // Audit log
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: 'LOCK',
                    model: 'Shift',
                    recordId: shiftId,
                    newData: { lockedAt: new Date().toISOString() }
                }
            });

            return NextResponse.json({ success: true, message: '🔒 ล็อกกะเรียบร้อย' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('[Admin Alerts POST]:', error);
        return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
    }
}
