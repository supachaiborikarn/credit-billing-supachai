import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { Decimal } from '@prisma/client/runtime/library';

interface MeterReading {
    startReading: Decimal;
    endReading: Decimal | null;
}

interface Transaction {
    liters: Decimal | null;
    amount: Decimal | null;
}

interface DailyRecordWithIncludes {
    id: string;
    date: Date;
    meters: MeterReading[];
    transactions: Transaction[];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month'); // Format: YYYY-MM

        if (!month) {
            return NextResponse.json({ error: 'Month is required' }, { status: 400 });
        }

        // Get station ID from constants (station-1 -> stationId)
        const stationIndex = parseInt(id) - 1;
        const station = STATIONS[stationIndex];
        if (!station) {
            return NextResponse.json({ error: 'Station not found' }, { status: 404 });
        }

        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);

        // Get all daily records for the month
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                stationId: station.id,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                meters: true,
            },
            orderBy: {
                date: 'desc',
            },
        });

        // Separately fetch ALL transactions for this station and date range
        // This ensures we count transactions even if they don't have dailyRecordId
        const allTransactions = await prisma.transaction.findMany({
            where: {
                stationId: station.id,
                date: {
                    gte: startDate,
                    lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000), // End of day
                },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                date: true,
                liters: true,
                amount: true,
            },
        });

        // Transform to history items
        const history = dailyRecords.map((record) => {
            const meterTotal = record.meters.reduce((sum: number, m: MeterReading) => {
                const end = m.endReading?.toNumber() || 0;
                const start = m.startReading?.toNumber() || 0;
                return sum + (end - start);
            }, 0);

            // Filter transactions for this specific date
            const recordDateStr = record.date.toISOString().split('T')[0];
            const dayTransactions = allTransactions.filter(t => {
                const txDateStr = t.date.toISOString().split('T')[0];
                return txDateStr === recordDateStr;
            });

            const transactionTotal = dayTransactions.reduce(
                (sum, t) => sum + (t.liters?.toNumber() || 0),
                0
            );

            const totalAmount = dayTransactions.reduce(
                (sum, t) => sum + (t.amount?.toNumber() || 0),
                0
            );

            const difference = transactionTotal - meterTotal;
            const hasAnomaly = Math.abs(difference) > 10; // More than 10 liters difference

            // Check for start meter status
            const hasStartMeter = record.meters.some((m: MeterReading) => m.startReading?.toNumber() > 0);
            const hasEndMeter = record.meters.some((m: MeterReading) => (m.endReading?.toNumber() || 0) > 0);

            let status: 'not_started' | 'recording' | 'closed' = 'not_started';
            if (hasStartMeter && hasEndMeter) {
                status = 'closed';
            } else if (hasStartMeter) {
                status = 'recording';
            }

            // Check for post-close edits (simplified - check if any transaction was updated after dailyRecord closed)
            const hasPostCloseEdit = false; // TODO: Implement when audit log integration is complete

            return {
                date: recordDateStr,
                status,
                meterTotal,
                transactionTotal,
                difference,
                transactionCount: dayTransactions.length,
                totalAmount,
                hasAnomaly,
                hasPostCloseEdit,
            };
        });

        // Generate empty entries for days without records
        const allDays = [];
        const currentDate = new Date(startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        while (currentDate <= endDate && currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const existingRecord = history.find(h => h.date === dateStr);

            if (existingRecord) {
                allDays.push(existingRecord);
            } else {
                allDays.push({
                    date: dateStr,
                    status: 'not_started' as const,
                    meterTotal: 0,
                    transactionTotal: 0,
                    difference: 0,
                    transactionCount: 0,
                    totalAmount: 0,
                    hasAnomaly: false,
                    hasPostCloseEdit: false,
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Sort by date descending
        allDays.sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({ history: allDays });
    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
