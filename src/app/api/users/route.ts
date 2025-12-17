import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                createdAt: true,
                station: {
                    select: { id: true, name: true }
                }
            }
        });

        // Map name to fullName for frontend compatibility
        const result = users.map(u => ({
            ...u,
            fullName: u.name,
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Users GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password, fullName, role, stationId } = body;

        // Check if username exists
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: fullName,
                role: role || 'STAFF',
                station: stationId ? { connect: { id: stationId } } : undefined,
            },
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
        console.error('User POST error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
