import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '@/lib/date-utils';

export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const stationId = searchParams.get('stationId');
        const includeVoided = searchParams.get('includeVoided') === 'true';

        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Build where clause
        const where: Record<string, unknown> = {
            date: { gte: startOfDay, lte: endOfDay },
        };

        if (stationId && stationId !== 'all') {
            where.stationId = stationId;
        }

        if (!includeVoided) {
            where.isVoided = false;
            where.deletedAt = null;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                recordedBy: { select: { name: true } },
                owner: { select: { name: true, code: true } },
                truck: { select: { code: true } },
                station: { select: { name: true } },
            }
        });

        const formattedTransactions = transactions.map(t => ({
            id: t.id,
            date: t.date.toISOString(),
            stationId: t.stationId,
            stationName: t.station.name,
            licensePlate: t.licensePlate,
            ownerName: t.owner?.name || t.ownerName || null,
            ownerCode: t.truck?.code || t.owner?.code || null,
            paymentType: t.paymentType,
            liters: Number(t.liters),
            pricePerLiter: Number(t.pricePerLiter),
            amount: Number(t.amount),
            productType: t.productType,
            isVoided: t.isVoided,
            voidReason: t.voidReason,
            recordedByName: t.recordedBy?.name || '-',
        }));

        return NextResponse.json(formattedTransactions);
    } catch (error) {
        console.error('Admin transactions GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
