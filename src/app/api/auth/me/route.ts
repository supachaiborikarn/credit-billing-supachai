import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    include: { station: true }
                }
            }
        });

        if (!session || session.expiresAt < new Date()) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        // Force re-login for GAS station staff for sessions created before 2026-01-11 (V2 migration)
        const v2MigrationDate = new Date('2026-01-11T00:00:00+07:00');
        const isGasStation = session.user.station?.type === 'GAS';
        if (isGasStation && session.createdAt < v2MigrationDate) {
            // Delete old session and force re-login
            await prisma.session.delete({ where: { id: sessionId } });
            return NextResponse.json({ user: null, reason: 'session_expired_v2_migration' }, { status: 401 });
        }

        return NextResponse.json({
            user: {
                id: session.user.id,
                name: session.user.name,
                role: session.user.role,
                stationId: session.user.stationId,
                stationName: session.user.station?.name,
                stationType: session.user.station?.type, // 'FULL', 'SIMPLE', 'GAS'
            }
        });
    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json({ user: null }, { status: 500 });
    }
}
