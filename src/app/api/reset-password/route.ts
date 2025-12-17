import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Temporary endpoint to reset password for วุฒิ
// DELETE THIS FILE after use!
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username');
        const newPassword = searchParams.get('password');

        if (!username || !newPassword) {
            return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { name: { contains: username } }
                ]
            }
        });

        if (!user) {
            // List all users for debugging
            const allUsers = await prisma.user.findMany({
                select: { id: true, username: true, name: true }
            });
            return NextResponse.json({
                error: 'User not found',
                availableUsers: allUsers
            }, { status: 404 });
        }

        // Hash new password with bcrypt
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        return NextResponse.json({
            success: true,
            message: `Password reset for ${user.username} (${user.name})`
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }
}
