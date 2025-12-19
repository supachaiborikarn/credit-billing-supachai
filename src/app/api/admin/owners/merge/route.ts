import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// POST: Merge two owners (move all trucks and transactions from source to target, delete source)
export async function POST(request: NextRequest) {
    try {
        // Check admin session
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
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { sourceOwnerId, targetOwnerId } = body;

        if (!sourceOwnerId || !targetOwnerId) {
            return NextResponse.json({ error: 'Source and target owner IDs required' }, { status: 400 });
        }

        if (sourceOwnerId === targetOwnerId) {
            return NextResponse.json({ error: 'Cannot merge owner with itself' }, { status: 400 });
        }

        // Get both owners
        const [sourceOwner, targetOwner] = await Promise.all([
            prisma.owner.findUnique({
                where: { id: sourceOwnerId },
                include: { _count: { select: { trucks: true, transactions: true } } }
            }),
            prisma.owner.findUnique({
                where: { id: targetOwnerId },
                include: { _count: { select: { trucks: true, transactions: true } } }
            })
        ]);

        if (!sourceOwner) {
            return NextResponse.json({ error: 'Source owner not found' }, { status: 404 });
        }

        if (!targetOwner) {
            return NextResponse.json({ error: 'Target owner not found' }, { status: 404 });
        }

        // Move all trucks from source to target
        const trucksResult = await prisma.truck.updateMany({
            where: { ownerId: sourceOwnerId },
            data: { ownerId: targetOwnerId }
        });

        // Move all transactions from source to target
        const transactionsResult = await prisma.transaction.updateMany({
            where: { ownerId: sourceOwnerId },
            data: {
                ownerId: targetOwnerId,
                ownerName: targetOwner.name
            }
        });

        // Delete source owner
        await prisma.owner.delete({
            where: { id: sourceOwnerId }
        });

        return NextResponse.json({
            success: true,
            message: `Merged "${sourceOwner.name}" into "${targetOwner.name}"`,
            trucksMoved: trucksResult.count,
            transactionsMoved: transactionsResult.count,
            deletedOwner: sourceOwner.name,
            targetOwner: targetOwner.name
        });

    } catch (error) {
        console.error('Owner merge error:', error);
        return NextResponse.json({ error: 'Failed to merge owners' }, { status: 500 });
    }
}
