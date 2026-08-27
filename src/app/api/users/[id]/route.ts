import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import { isUserRole } from '@/constants/user-roles';

interface UserUpdateData {
    name?: string;
    role?: UserRole;
    password?: string;
    station?: Prisma.StationUpdateOneWithoutUsersNestedInput;
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

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
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { fullName, role, stationId, password } = body;
        if (role !== undefined && !isUserRole(role)) {
            return NextResponse.json({ error: 'บทบาทผู้ใช้ไม่ถูกต้อง' }, { status: 400 });
        }

        const data: UserUpdateData = { name: fullName };
        if (role !== undefined) data.role = role;
        if (password) {
            data.password = await hashPassword(password);
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
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;

        if (auth.user.id === id) {
            return NextResponse.json({ error: 'ไม่สามารถลบผู้ใช้ตัวเองได้' }, { status: 400 });
        }

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
