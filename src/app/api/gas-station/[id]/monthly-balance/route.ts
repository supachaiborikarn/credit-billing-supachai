import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEndOfDayBangkokUTC, getStartOfDayBangkokUTC, getTodayBangkok, toBangkokDateKey } from '@/lib/gas';
import { requireGasStationAccess } from '@/lib/gas/api-guards';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const stationId = auth.station.dbId;
        const { searchParams } = new URL(request.url);

        // Get month and year (default to current month)
        const [currentYear, currentMonth] = getTodayBangkok().split('-').map(Number);
        const year = parseInt(searchParams.get('year') || currentYear.toString());
        const month = parseInt(searchParams.get('month') || currentMonth.toString());

        // Calculate date range for the month
        const monthPart = String(month).padStart(2, '0');
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const startKey = `${year}-${monthPart}-01`;
        const endKey = `${year}-${monthPart}-${String(lastDay).padStart(2, '0')}`;

        const startOfMonth = getStartOfDayBangkokUTC(startKey);
        const endOfMonth = getEndOfDayBangkokUTC(endKey);

        // Get gas supplies for the month
        const supplies = await prisma.gasSupply.findMany({
            where: {
                stationId,
                date: { gte: startOfMonth, lte: endOfMonth }
            },
            orderBy: { date: 'asc' }
        });

        // Get transactions (sales) for the month
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId,
                productType: 'LPG',
                deletedAt: null,
                isVoided: false,
                date: { gte: startOfMonth, lte: endOfMonth }
            },
            orderBy: { date: 'asc' }
        });

        // Get gauge readings for start and end of month
        const startGauges = await prisma.gaugeReading.findMany({
            where: {
                stationId,
                date: { gte: startOfMonth, lte: new Date(startOfMonth.getTime() + 24 * 60 * 60 * 1000) }
            },
            orderBy: { createdAt: 'asc' }
        });

        const endGauges = await prisma.gaugeReading.findMany({
            where: {
                stationId,
                date: { gte: new Date(endOfMonth.getTime() - 24 * 60 * 60 * 1000), lte: endOfMonth }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate totals
        const LITERS_PER_PERCENT = 98;

        // Total supplies received
        const totalSupplies = supplies.reduce((sum, s) => sum + Number(s.liters), 0);

        // Total sales
        const totalSales = transactions.reduce((sum, t) => sum + Number(t.liters), 0);

        // Opening stock (from gauge readings at start of month)
        let openingStock = 0;
        [1, 2, 3].forEach(tankNum => {
            const reading = startGauges.find(g => g.tankNumber === tankNum);
            if (reading) {
                openingStock += Number(reading.percentage) * LITERS_PER_PERCENT;
            }
        });

        // Closing stock (from gauge readings at end of month)
        let closingStock = 0;
        [1, 2, 3].forEach(tankNum => {
            const reading = endGauges.find(g => g.tankNumber === tankNum);
            if (reading) {
                closingStock += Number(reading.percentage) * LITERS_PER_PERCENT;
            }
        });

        // Expected closing = Opening + Supplies - Sales
        const expectedClosing = openingStock + totalSupplies - totalSales;

        // Variance = Actual closing - Expected closing
        const variance = closingStock - expectedClosing;
        const variancePercent = expectedClosing > 0 ? (variance / expectedClosing * 100) : 0;

        // Group supplies by date
        const suppliesByDate = supplies.reduce((acc, s) => {
            const dateKey = toBangkokDateKey(s.date);
            if (!acc[dateKey]) {
                acc[dateKey] = { date: dateKey, liters: 0, count: 0 };
            }
            acc[dateKey].liters += Number(s.liters);
            acc[dateKey].count += 1;
            return acc;
        }, {} as Record<string, { date: string; liters: number; count: number }>);

        // Group sales by date
        const salesByDate = transactions.reduce((acc, t) => {
            const dateKey = toBangkokDateKey(t.date);
            if (!acc[dateKey]) {
                acc[dateKey] = { date: dateKey, liters: 0, amount: 0, count: 0 };
            }
            acc[dateKey].liters += Number(t.liters);
            acc[dateKey].amount += Number(t.amount);
            acc[dateKey].count += 1;
            return acc;
        }, {} as Record<string, { date: string; liters: number; amount: number; count: number }>);

        return NextResponse.json({
            year,
            month,
            startDate: startOfMonth.toISOString(),
            endDate: endOfMonth.toISOString(),
            summary: {
                openingStock,
                totalSupplies,
                totalSales,
                expectedClosing,
                closingStock,
                variance,
                variancePercent,
                isBalanced: Math.abs(variancePercent) <= 5
            },
            supplies: Object.values(suppliesByDate),
            sales: Object.values(salesByDate),
            transactionCount: transactions.length,
            supplyCount: supplies.length
        });
    } catch (error) {
        console.error('Monthly balance report error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
