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
