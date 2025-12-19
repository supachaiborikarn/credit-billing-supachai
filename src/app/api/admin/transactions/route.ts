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

        // Build a map of normalized licensePlate -> code for transactions without truck relation
        const normalizePlate = (plate: string) =>
            plate.replace(/^[ก-ฮ]+/, '').replace(/[-\s]/g, '').toUpperCase();

        const licensePlates = transactions
            .filter(t => !t.truck && t.licensePlate)
            .map(t => t.licensePlate)
            .filter((p): p is string => p !== null);

        let truckCodeMap: Record<string, string> = {};
        if (licensePlates.length > 0) {
            const trucks = await prisma.truck.findMany({
                where: { code: { not: null } },
                select: { licensePlate: true, code: true }
            });
            trucks.forEach((t: { licensePlate: string; code: string | null }) => {
                if (t.code) {
                    truckCodeMap[t.licensePlate] = t.code;
                    truckCodeMap[normalizePlate(t.licensePlate)] = t.code;
                    if (t.licensePlate.includes('/')) {
                        t.licensePlate.split('/').forEach(part => {
                            truckCodeMap[part.trim()] = t.code!;
                            truckCodeMap[normalizePlate(part.trim())] = t.code!;
                        });
                    }
                }
            });
        }

        const findCode = (plate: string): string | null => {
            if (!plate) return null;
            if (truckCodeMap[plate]) return truckCodeMap[plate];
            const normalized = normalizePlate(plate);
            if (truckCodeMap[normalized]) return truckCodeMap[normalized];
            if (truckCodeMap['กพ' + normalized]) return truckCodeMap['กพ' + normalized];
            return null;
        };

        const formattedTransactions = transactions.map(t => {
            const plate = t.licensePlate || '';
            return {
                id: t.id,
                date: t.date.toISOString(),
                stationId: t.stationId,
                stationName: t.station.name,
                licensePlate: plate,
                ownerName: t.owner?.name || t.ownerName || null,
                ownerCode: t.truck?.code || findCode(plate) || t.owner?.code || null,
                paymentType: t.paymentType,
                liters: Number(t.liters),
                pricePerLiter: Number(t.pricePerLiter),
                amount: Number(t.amount),
                productType: t.productType,
                isVoided: t.isVoided,
                voidReason: t.voidReason,
                recordedByName: t.recordedBy?.name || '-',
            };
        });

        return NextResponse.json(formattedTransactions);
    } catch (error) {
        console.error('Admin transactions GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
