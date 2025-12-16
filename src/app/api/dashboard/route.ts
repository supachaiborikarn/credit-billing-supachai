import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        // Get 7 days range for weekly chart
        const sevenDaysAgo = new Date(dateStr);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Get counts and data
        const [totalOwners, totalTrucks, todayTransactions, pendingInvoices, stations, weeklyTransactions, allRecentTransactions] = await Promise.all([
            prisma.owner.count(),
            prisma.truck.count(),
            prisma.transaction.findMany({
                where: {
                    date: { gte: startOfDay, lte: endOfDay }
                },
                select: {
                    amount: true,
                    liters: true,
                    stationId: true
                }
            }),
            prisma.invoice.findMany({
                where: { status: 'PENDING' },
                select: { totalAmount: true }
            }),
            prisma.station.findMany({
                select: { id: true, name: true }
            }),
            // Weekly transactions for chart
            prisma.transaction.findMany({
                where: {
                    date: { gte: sevenDaysAgo, lte: endOfDay }
                },
                select: {
                    date: true,
                    amount: true,
                    liters: true,
                    paymentType: true
                }
            }),
            // For top customers (last 30 days)
            prisma.transaction.findMany({
                where: {
                    date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
                    ownerId: { not: null }
                },
                select: {
                    amount: true,
                    liters: true,
                    owner: {
                        select: { id: true, name: true, code: true }
                    }
                }
            })
        ]);

        // Calculate totals
        const todayAmount = todayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const pendingAmount = pendingInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

        // Station stats
        const stationStats = stations.map(station => {
            const stationTransactions = todayTransactions.filter(t => t.stationId === station.id);
            return {
                stationId: station.id,
                stationName: station.name,
                todayAmount: stationTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
                todayLiters: stationTransactions.reduce((sum, t) => sum + Number(t.liters), 0),
            };
        });

        // Weekly sales data for chart
        const weeklySales = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date(dateStr);
            day.setDate(day.getDate() - i);
            const dayStr = day.toISOString().split('T')[0];
            const dayTransactions = weeklyTransactions.filter(t => 
                new Date(t.date).toISOString().split('T')[0] === dayStr
            );
            weeklySales.push({
                date: dayStr,
                dayName: day.toLocaleDateString('th-TH', { weekday: 'short' }),
                amount: dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
                liters: dayTransactions.reduce((sum, t) => sum + Number(t.liters), 0),
                count: dayTransactions.length
            });
        }

        // Payment type stats
        const paymentTypes = ['CASH', 'CREDIT', 'TRANSFER', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'];
        const paymentTypeLabels: Record<string, string> = {
            'CASH': 'เงินสด',
            'CREDIT': 'เงินเชื่อ',
            'TRANSFER': 'โอนเงิน',
            'BOX_TRUCK': 'รถตู้ทึบ',
            'OIL_TRUCK_SUPACHAI': 'รถน้ำมันศุภชัย'
        };
        const paymentTypeColors: Record<string, string> = {
            'CASH': '#22c55e',
            'CREDIT': '#8b5cf6',
            'TRANSFER': '#3b82f6',
            'BOX_TRUCK': '#f97316',
            'OIL_TRUCK_SUPACHAI': '#ef4444'
        };
        const paymentTypeStats = paymentTypes.map(type => {
            const typeTransactions = weeklyTransactions.filter(t => t.paymentType === type);
            return {
                type,
                label: paymentTypeLabels[type] || type,
                color: paymentTypeColors[type] || '#6b7280',
                amount: typeTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
                count: typeTransactions.length
            };
        }).filter(s => s.count > 0);

        // Top 5 customers
        const customerStats: Record<string, { id: string; name: string; code: string | null; amount: number; liters: number; count: number }> = {};
        allRecentTransactions.forEach(t => {
            if (t.owner) {
                if (!customerStats[t.owner.id]) {
                    customerStats[t.owner.id] = {
                        id: t.owner.id,
                        name: t.owner.name,
                        code: t.owner.code,
                        amount: 0,
                        liters: 0,
                        count: 0
                    };
                }
                customerStats[t.owner.id].amount += Number(t.amount);
                customerStats[t.owner.id].liters += Number(t.liters);
                customerStats[t.owner.id].count += 1;
            }
        });
        const topCustomers = Object.values(customerStats)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        return NextResponse.json({
            totalOwners,
            totalTrucks,
            todayTransactions: todayTransactions.length,
            todayAmount,
            pendingInvoices: pendingInvoices.length,
            pendingAmount,
            stationStats,
            weeklySales,
            paymentTypeStats,
            topCustomers,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
    }
}
