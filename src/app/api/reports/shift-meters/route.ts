import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface MeterReading {
    nozzleNumber: number;
    startReading: Decimal;
    endReading: Decimal | null;
    soldQty: Decimal | null;
}

interface DailyRecordWithRelations {
    id: string;
    date: Date;
    station: { id: string; name: string };
    meters: MeterReading[];
    shifts: {
        id: string;
        shiftNumber: number;
        status: string;
        createdAt: Date;
        closedAt: Date | null;
        staff: { name: string } | null;
    }[];
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build where clause for dailyRecord
        const where: Record<string, unknown> = {};

        if (stationId) {
            where.stationId = stationId;
        }

        if (startDate || endDate) {
            where.date = {
                ...(startDate ? { gte: new Date(startDate + 'T00:00:00+07:00') } : {}),
                ...(endDate ? { lte: new Date(endDate + 'T23:59:59+07:00') } : {})
            };
        }

        // Fetch daily records with meter readings  
        const dailyRecords = await prisma.dailyRecord.findMany({
            where,
            include: {
                station: { select: { id: true, name: true } },
                meters: {
                    select: {
                        nozzleNumber: true,
                        startReading: true,
                        endReading: true,
                        soldQty: true,
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
                        staff: { select: { name: true } }
                    },
                    orderBy: { shiftNumber: 'asc' }
                }
            },
            orderBy: { date: 'desc' }
        }) as unknown as DailyRecordWithRelations[];

        // Transform data - one row per shift or per daily record if no shifts
        const result: unknown[] = [];

        for (const record of dailyRecords) {
            // Get meter readings for this daily record
            const getMeter = (nozzle: number) => record.meters.find(m => m.nozzleNumber === nozzle);

            // Calculate sold qty (endReading - startReading)
            const calculateSold = (nozzle: number) => {
                const m = getMeter(nozzle);
                if (m && m.endReading && m.startReading) {
                    return Number(m.endReading) - Number(m.startReading);
                }
                return null;
            };

            // Calculate total sold for this day
            const totalSold = [1, 2, 3, 4].reduce((sum, n) => {
                const sold = calculateSold(n);
                return sum + (sold || 0);
            }, 0);

            if (record.shifts.length > 0) {
                // One row per shift
                for (const shift of record.shifts) {
                    result.push({
                        id: shift.id,
                        date: record.date.toISOString().split('T')[0],
                        stationId: record.station.id,
                        stationName: record.station.name,
                        shiftNumber: shift.shiftNumber,
                        status: shift.status,
                        staff: shift.staff?.name || null,
                        openedAt: shift.createdAt.toISOString(),
                        closedAt: shift.closedAt?.toISOString() || null,
                        meters: [1, 2, 3, 4].map(n => {
                            const m = getMeter(n);
                            return {
                                nozzleNumber: n,
                                startReading: m ? Number(m.startReading) : null,
                                endReading: m && m.endReading ? Number(m.endReading) : null,
                                soldQty: calculateSold(n)
                            };
                        }),
                        totalSold
                    });
                }
            } else {
                // No shifts - still show the daily record meters
                result.push({
                    id: record.id,
                    date: record.date.toISOString().split('T')[0],
                    stationId: record.station.id,
                    stationName: record.station.name,
                    shiftNumber: null,
                    status: 'NO_SHIFT',
                    staff: null,
                    openedAt: null,
                    closedAt: null,
                    meters: [1, 2, 3, 4].map(n => {
                        const m = getMeter(n);
                        return {
                            nozzleNumber: n,
                            startReading: m ? Number(m.startReading) : null,
                            endReading: m && m.endReading ? Number(m.endReading) : null,
                            soldQty: calculateSold(n)
                        };
                    }),
                    totalSold
                });
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching shift meters:', error);
        return NextResponse.json({ error: 'Failed to fetch shift meters' }, { status: 500 });
    }
}
