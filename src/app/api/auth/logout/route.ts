import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (sessionId) {
            await prisma.session.delete({
                where: { id: sessionId }
            }).catch(() => { });
        }

        const response = NextResponse.json({ success: true });
        response.cookies.delete('session');

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}
