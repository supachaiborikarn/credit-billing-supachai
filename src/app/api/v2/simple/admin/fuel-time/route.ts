import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';

// GET: Fuel Type & Time Analytics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');
        const selectedStation = searchParams.get('stationId');

        const simpleStations = STATIONS.filter(s => s.type === 'SIMPLE');
        const stationIds = selectedStation
            ? [selectedStation]
            : simpleStations.map(s => s.id);

        const todayStr = getTodayBangkok();
        const endOfDay = getEndOfDayBangkok(todayStr);

        const startDate = new Date(endOfDay);
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // ========== By Fuel Type ==========
        const byFuelType = await prisma.transaction.groupBy({
            by: ['productType'],
            where: {
                stationId: { in: stationIds },
                date: { gte: startDate, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            _sum: { liters: true, amount: true },
            _count: { id: true }
        });

        // ========== By Hour (Peak Hour Analysis) ==========
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId: { in: stationIds },
                date: { gte: startDate, lte: endOfDay },
                isVoided: false,
                deletedAt: null
            },
            select: { date: true, liters: true, amount: true }
        });

        // Group by hour
        const byHour: { [hour: number]: { liters: number; revenue: number; count: number } } = {};
        for (let i = 0; i < 24; i++) {
            byHour[i] = { liters: 0, revenue: 0, count: 0 };
        }

        transactions.forEach(t => {
            const hour = t.date.getHours();
            byHour[hour].liters += Number(t.liters);
            byHour[hour].revenue += Number(t.amount);
            byHour[hour].count += 1;
        });

        const hourlyData = Object.entries(byHour).map(([hour, data]) => ({
            hour: parseInt(hour),
            liters: data.liters,
            revenue: data.revenue,
            count: data.count
        }));

        // ========== Daily Breakdown by Fuel Type ==========
        const dailyByFuel: { [date: string]: { [fuel: string]: number } } = {};

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(endOfDay);
            d.setDate(d.getDate() - i);
            dailyByFuel[d.toISOString().split('T')[0]] = {};
        }

        transactions.forEach(t => {
            const dateKey = t.date.toISOString().split('T')[0];
            // Note: productType might be null
            const fuelType = 'productType' in t && t.productType ? String(t.productType) : 'อื่นๆ';
            if (dailyByFuel[dateKey]) {
                dailyByFuel[dateKey][fuelType] = (dailyByFuel[dateKey][fuelType] || 0) + Number(t.liters);
            }
        });

        const dailyFuelData = Object.entries(dailyByFuel).map(([date, fuels]) => ({
            date,
            fuels
        }));

        // Find peak hour
        const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);

        return NextResponse.json({
            period: { days },
            byFuelType: byFuelType.map(f => ({
                fuelType: f.productType || 'อื่นๆ',
                liters: Number(f._sum.liters) || 0,
                revenue: Number(f._sum.amount) || 0,
                count: f._count.id
            })),
            hourlyData,
            peakHour: { hour: peakHour.hour, count: peakHour.count },
            dailyByFuel: dailyFuelData
        });
    } catch (error) {
        console.error('Error fetching fuel-time:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
