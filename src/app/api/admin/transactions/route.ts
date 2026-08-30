import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { requireAdminApi } from '@/lib/api-auth';
import { resolveStationDefinition } from '@/lib/stations/station-context';
import { buildTruckCodeMap, findCodeByPlate } from '@/lib/truck-utils';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();
        const stationInput = searchParams.get('stationId');
        const includeVoided = searchParams.get('includeVoided') === 'true';

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 });
        }
        const parsedDate = getStartOfDayBangkok(dateStr);
        if (Number.isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: 'วันที่ไม่ถูกต้อง' }, { status: 400 });
        }

        const station = stationInput && stationInput !== 'all' ? resolveStationDefinition(stationInput) : null;
        if (stationInput && stationInput !== 'all' && !station) {
            return NextResponse.json({ error: 'ไม่พบสถานี' }, { status: 400 });
        }

        const startOfDay = parsedDate;
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Build where clause
        const where: Record<string, unknown> = {
            date: { gte: startOfDay, lte: endOfDay },
        };

        if (station) {
            where.stationId = station.id;
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

        // Build truck code map for C-Code lookup
        const truckCodeMap = await buildTruckCodeMap();

        const formattedTransactions = transactions.map(t => {
            const plate = t.licensePlate || '';
            return {
                id: t.id,
                date: t.date.toISOString(),
                stationId: t.stationId,
                stationName: t.station.name,
                licensePlate: plate,
                ownerName: t.owner?.name || t.ownerName || null,
                ownerCode: t.truck?.code || findCodeByPlate(plate, truckCodeMap) || t.owner?.code || null,
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
