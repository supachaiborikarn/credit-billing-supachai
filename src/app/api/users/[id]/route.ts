import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                station: { select: { id: true, name: true } }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ ...user, fullName: user.name });
    } catch (error) {
        console.error('User GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { fullName, role, stationId, password } = body;

        const data: any = { name: fullName, role };
        if (password) {
            data.password = hashPassword(password);
        }
        if (stationId) {
            data.station = { connect: { id: stationId } };
        } else if (stationId === '') {
            data.station = { disconnect: true };
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                station: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json({ ...user, fullName: user.name });
    } catch (error) {
        console.error('User PUT error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Don't allow deleting yourself or the last admin
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        const user = await prisma.user.findUnique({ where: { id } });

        if (user?.role === 'ADMIN' && adminCount <= 1) {
            return NextResponse.json({ error: 'ไม่สามารถลบ Admin คนสุดท้ายได้' }, { status: 400 });
        }

        await prisma.user.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
