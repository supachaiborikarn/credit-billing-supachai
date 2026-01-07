import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause for shifts
        const where: Record<string, unknown> = {};

        if (stationId) {
            where.dailyRecord = { stationId };
        }

        if (startDate || endDate) {
            where.dailyRecord = {
                ...(where.dailyRecord as object || {}),
                date: {
                    ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                    ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
                }
            };
        }

        // Fetch all shifts with their meter readings
        const shifts = await prisma.shift.findMany({
            where,
            include: {
                dailyRecord: {
                    select: {
                        date: true,
                        station: { select: { id: true, name: true } }
                    }
                },
                staff: { select: { name: true } },
                closedBy: { select: { name: true } },
                meters: {
                    select: {
                        nozzleNumber: true,
                        startReading: true,
                        endReading: true,
                        soldQty: true
                    },
                    orderBy: { nozzleNumber: 'asc' }
                }
            },
            orderBy: [
                { dailyRecord: { date: 'desc' } },
                { shiftNumber: 'desc' }
            ]
        });

        // Transform data - one row per shift
        const result = shifts.map(shift => {
            // Calculate sold qty for each nozzle (if not already calculated)
            const metersWithSold = [1, 2, 3, 4].map(nozzle => {
                const meter = shift.meters.find(m => m.nozzleNumber === nozzle);
                if (!meter) {
                    return {
                        nozzleNumber: nozzle,
                        startReading: null,
                        endReading: null,
                        soldQty: null
                    };
                }
                const start = Number(meter.startReading);
                const end = meter.endReading ? Number(meter.endReading) : null;
                const sold = meter.soldQty
                    ? Number(meter.soldQty)
                    : (end && start ? end - start : null);
                return {
                    nozzleNumber: nozzle,
                    startReading: start,
                    endReading: end,
                    soldQty: sold
                };
            });

            const totalSold = metersWithSold.reduce((sum, m) => sum + (m.soldQty || 0), 0);

            return {
                id: shift.id,
                date: shift.dailyRecord.date.toISOString().split('T')[0],
                stationId: shift.dailyRecord.station.id,
                stationName: shift.dailyRecord.station.name,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staff: shift.staff?.name || null,
                closedBy: shift.closedBy?.name || null,
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                meters: metersWithSold,
                totalSold,
                hasMeterData: shift.meters.length > 0
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
