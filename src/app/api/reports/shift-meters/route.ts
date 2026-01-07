import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause for shifts directly
        const shiftWhere: Record<string, unknown> = {};

        if (stationId) {
            shiftWhere.dailyRecord = { stationId };
        }

        if (startDate || endDate) {
            shiftWhere.dailyRecord = {
                ...(shiftWhere.dailyRecord as object || {}),
                date: {
                    ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                    ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
                }
            };
        }

        // Fetch all shifts directly (not dailyRecords)
        const shifts = await prisma.shift.findMany({
            where: shiftWhere,
            include: {
                dailyRecord: {
                    select: {
                        id: true,
                        date: true,
                        station: { select: { id: true, name: true } },
                        meters: {
                            select: {
                                nozzleNumber: true,
                                startReading: true,
                                endReading: true,
                                soldQty: true,
                                shiftId: true
                            },
                            orderBy: { nozzleNumber: 'asc' }
                        }
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

        // Also get meters from dailyRecords that don't have shifts but match the date
        // Group by date to find meters from sibling dailyRecords
        const metersByDate: Record<string, Array<{ nozzleNumber: number; startReading: number; endReading: number | null; soldQty: number | null }>> = {};

        if (stationId) {
            const dailyRecords = await prisma.dailyRecord.findMany({
                where: {
                    stationId,
                    meters: { some: {} },
                    ...(startDate || endDate ? {
                        date: {
                            ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                            ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
                        }
                    } : {})
                },
                select: {
                    date: true,
                    meters: {
                        select: {
                            nozzleNumber: true,
                            startReading: true,
                            endReading: true,
                            soldQty: true
                        }
                    }
                }
            });

            for (const dr of dailyRecords) {
                // Convert to Bangkok date string for grouping
                const dateKey = new Date(dr.date.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
                if (!metersByDate[dateKey]) {
                    metersByDate[dateKey] = [];
                }
                for (const m of dr.meters) {
                    // Only add if not already exists
                    if (!metersByDate[dateKey].find(existing => existing.nozzleNumber === m.nozzleNumber)) {
                        metersByDate[dateKey].push({
                            nozzleNumber: m.nozzleNumber,
                            startReading: Number(m.startReading),
                            endReading: m.endReading ? Number(m.endReading) : null,
                            soldQty: m.soldQty ? Number(m.soldQty) : null
                        });
                    }
                }
            }
        }

        // Transform data - one row per shift
        const result = shifts.map(shift => {
            // Convert shift date to Bangkok date string
            const shiftDate = new Date(shift.dailyRecord.date.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Use shift-level meters first, then dailyRecord meters, then sibling meters
            let metersSource = shift.meters;
            if (metersSource.length === 0) {
                metersSource = shift.dailyRecord.meters.filter(m => m.shiftId === shift.id || m.shiftId === null);
            }

            // Convert to numbers
            const metersArray = metersSource.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
                soldQty: m.soldQty ? Number(m.soldQty) : null
            }));

            // If still empty, try sibling dailyRecord by date
            if (metersArray.length === 0 && metersByDate[shiftDate]) {
                metersArray.push(...metersByDate[shiftDate]);
            }

            const metersWithSold = [1, 2, 3, 4].map(nozzle => {
                const meter = metersArray.find(m => m.nozzleNumber === nozzle);
                if (!meter) {
                    return {
                        nozzleNumber: nozzle,
                        startReading: null,
                        endReading: null,
                        soldQty: null
                    };
                }
                const start = meter.startReading;
                const end = meter.endReading;
                const sold = meter.soldQty ?? (end && start ? end - start : null);
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
                date: shiftDate,
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
                hasMeterData: metersArray.length > 0
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
