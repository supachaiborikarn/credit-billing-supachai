import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause for dailyRecord
        const dailyRecordWhere: Record<string, unknown> = {};

        if (stationId) {
            dailyRecordWhere.stationId = stationId;
        }

        if (startDate || endDate) {
            dailyRecordWhere.date = {
                ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
            };
        }

        // Fetch all shifts with their meter readings (or dailyRecord meters if shift meters don't exist)
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: dailyRecordWhere,
            include: {
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
                },
                shifts: {
                    select: {
                        id: true,
                        shiftNumber: true,
                        status: true,
                        createdAt: true,
                        closedAt: true,
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
                    orderBy: { shiftNumber: 'asc' }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Transform data - one row per shift (or per daily record if no shifts)
        const result: unknown[] = [];

        for (const record of dailyRecords) {
            if (record.shifts.length > 0) {
                // One row per shift
                for (const shift of record.shifts) {
                    // Use shift-level meters if available, otherwise fall back to daily meters
                    const metersSource = shift.meters.length > 0
                        ? shift.meters
                        : record.meters.filter(m => m.shiftId === shift.id || m.shiftId === null);

                    const metersWithSold = [1, 2, 3, 4].map(nozzle => {
                        const meter = metersSource.find(m => m.nozzleNumber === nozzle);
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

                    result.push({
                        id: shift.id,
                        date: record.date.toISOString().split('T')[0],
                        stationId: record.station.id,
                        stationName: record.station.name,
                        shiftNumber: shift.shiftNumber,
                        status: shift.status,
                        staff: shift.staff?.name || null,
                        closedBy: shift.closedBy?.name || null,
                        openedAt: shift.createdAt.toISOString(),
                        closedAt: shift.closedAt?.toISOString() || null,
                        meters: metersWithSold,
                        totalSold,
                        hasMeterData: metersSource.length > 0
                    });
                }
            } else if (record.meters.length > 0) {
                // No shifts but has daily meters - show as single row
                const metersWithSold = [1, 2, 3, 4].map(nozzle => {
                    const meter = record.meters.find(m => m.nozzleNumber === nozzle);
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

                result.push({
                    id: record.id,
                    date: record.date.toISOString().split('T')[0],
                    stationId: record.station.id,
                    stationName: record.station.name,
                    shiftNumber: null,
                    status: 'DAILY',
                    staff: null,
                    closedBy: null,
                    openedAt: null,
                    closedAt: null,
                    meters: metersWithSold,
                    totalSold,
                    hasMeterData: true
                });
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
