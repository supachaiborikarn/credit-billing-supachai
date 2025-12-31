import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { VarianceStatus } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const todayStr = getTodayBangkok();
        const endStr = searchParams.get('end') || todayStr;
        const startStr = searchParams.get('start') || (() => {
            const d = new Date(endStr);
            d.setDate(d.getDate() - 6);
            return d.toISOString().split('T')[0];
        })();

        // Validate max 31 days
        const start = new Date(startStr);
        const end = new Date(endStr);
        const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 31) {
            start.setTime(end.getTime() - 31 * 24 * 60 * 60 * 1000);
        }

        // Get daily records with reconciliations
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                date: { gte: start, lte: end }
            },
            include: {
                shifts: {
                    where: { status: 'LOCKED' },
                    include: { reconciliation: true }
                }
            }
        });

        // Build daily series
        const result: Array<{
            date: string;
            expected_amount_total: number;
            variance_abs_total: number;
            red: number;
            yellow: number;
        }> = [];

        const current = new Date(start);
        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            const dayRecords = dailyRecords.filter(r =>
                new Date(r.date).toISOString().split('T')[0] === dateStr
            );

            let expectedAmount = 0;
            let varianceAbs = 0;
            let redCount = 0;
            let yellowCount = 0;

            dayRecords.forEach(record => {
                record.shifts.forEach(shift => {
                    if (shift.reconciliation) {
                        expectedAmount += Number(shift.reconciliation.totalExpected);
                        varianceAbs += Math.abs(Number(shift.reconciliation.variance));
                        if (shift.reconciliation.varianceStatus === VarianceStatus.RED) redCount++;
                        if (shift.reconciliation.varianceStatus === VarianceStatus.YELLOW) yellowCount++;
                    }
                });
            });

            result.push({
                date: dateStr,
                expected_amount_total: Math.round(expectedAmount * 100) / 100,
                variance_abs_total: Math.round(varianceAbs * 100) / 100,
                red: redCount,
                yellow: yellowCount
            });

            current.setDate(current.getDate() + 1);
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Trends API error:', error);
        return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
    }
}
