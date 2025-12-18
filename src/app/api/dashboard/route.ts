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

        // Yesterday for comparison
        const yesterdayStart = new Date(startOfDay);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(endOfDay);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

        // Get 7 days range for weekly chart
        const sevenDaysAgo = new Date(dateStr);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Get 30 days range for monthly heat map
        const thirtyDaysAgo = new Date(dateStr);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        // Get counts and data
        const [
            totalOwners,
            totalTrucks,
            todayTransactions,
            yesterdayTransactions,
            pendingInvoices,
            stations,
            weeklyTransactions,
            allRecentTransactions,
            recentTransactionsList,
            monthlyTransactions,
            gasStations
        ] = await Promise.all([
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
            // Yesterday transactions for comparison
            prisma.transaction.findMany({
                where: {
                    date: { gte: yesterdayStart, lte: yesterdayEnd }
                },
                select: {
                    amount: true,
                    liters: true
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
            }),
            // Recent 10 transactions for live feed
            prisma.transaction.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    date: true,
                    createdAt: true,
                    licensePlate: true,
                    ownerName: true,
                    amount: true,
                    liters: true,
                    paymentType: true,
                    station: { select: { name: true } },
                    owner: { select: { name: true } }
                }
            }),
            // Monthly transactions for heat map
            prisma.transaction.findMany({
                where: {
                    date: { gte: thirtyDaysAgo, lte: endOfDay }
                },
                select: {
                    date: true,
                    amount: true
                }
            }),
            // Gas stations for alert checking
            prisma.station.findMany({
                where: { type: 'GAS' },
                select: {
                    id: true,
                    name: true,
                    gasStockAlert: true
                }
            })
        ]);

        // Additional queries for alerts
        const [latestGaugeReadings, transfersWithoutProof, transactionsWithoutMeter] = await Promise.all([
            // Latest gauge readings for each gas station
            prisma.gaugeReading.findMany({
                where: {
                    stationId: { in: gasStations.map(s => s.id) }
                },
                orderBy: { createdAt: 'desc' },
                distinct: ['stationId', 'tankNumber'],
                select: {
                    stationId: true,
                    tankNumber: true,
                    percentage: true,
                    date: true
                }
            }),
            // Transfer transactions without proof (last 7 days)
            prisma.transaction.count({
                where: {
                    paymentType: 'TRANSFER',
                    transferProofUrl: null,
                    date: { gte: sevenDaysAgo }
                }
            }),
            // Transactions today without meter reading (for FULL stations)
            prisma.transaction.count({
                where: {
                    date: { gte: startOfDay, lte: endOfDay },
                    nozzleNumber: null,
                    station: { type: 'FULL' }
                }
            })
        ]);

        // Calculate totals
        const todayAmount = todayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const todayLiters = todayTransactions.reduce((sum, t) => sum + Number(t.liters), 0);
        const yesterdayAmount = yesterdayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const yesterdayLiters = yesterdayTransactions.reduce((sum, t) => sum + Number(t.liters), 0);
        const pendingAmount = pendingInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

        // Calculate percentage changes
        const amountPercentChange = yesterdayAmount > 0
            ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100
            : todayAmount > 0 ? 100 : 0;
        const litersPercentChange = yesterdayLiters > 0
            ? ((todayLiters - yesterdayLiters) / yesterdayLiters) * 100
            : todayLiters > 0 ? 100 : 0;
        const countPercentChange = yesterdayTransactions.length > 0
            ? ((todayTransactions.length - yesterdayTransactions.length) / yesterdayTransactions.length) * 100
            : todayTransactions.length > 0 ? 100 : 0;

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

        // Format recent transactions for feed
        const recentTransactions = recentTransactionsList.map(t => ({
            id: t.id,
            date: t.date,
            createdAt: t.createdAt,
            licensePlate: t.licensePlate || '-',
            ownerName: t.owner?.name || t.ownerName || '-',
            amount: Number(t.amount),
            liters: Number(t.liters),
            paymentType: t.paymentType,
            stationName: t.station.name
        }));

        // Monthly heat map data
        const monthlyHeatMap: Record<string, number> = {};
        monthlyTransactions.forEach(t => {
            const dayStr = new Date(t.date).toISOString().split('T')[0];
            if (!monthlyHeatMap[dayStr]) {
                monthlyHeatMap[dayStr] = 0;
            }
            monthlyHeatMap[dayStr] += Number(t.amount);
        });
        const heatMapData = Object.entries(monthlyHeatMap).map(([date, amount]) => ({
            date,
            amount
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Generate alerts
        const alerts: { type: string; severity: 'info' | 'warning' | 'critical'; message: string }[] = [];

        // Alert: Sales spike or drop > 30%
        if (Math.abs(amountPercentChange) > 30 && yesterdayAmount > 0) {
            alerts.push({
                type: 'sales',
                severity: amountPercentChange > 0 ? 'info' : 'warning',
                message: amountPercentChange > 0
                    ? `ยอดขายวันนี้พุ่งขึ้น ${amountPercentChange.toFixed(0)}% จากเมื่อวาน`
                    : `ยอดขายวันนี้ลดลง ${Math.abs(amountPercentChange).toFixed(0)}% จากเมื่อวาน`
            });
        }

        // Alert: Low pending invoices (just info)
        if (pendingInvoices.length > 10) {
            alerts.push({
                type: 'invoice',
                severity: 'warning',
                message: `มีใบวางบิลค้างชำระ ${pendingInvoices.length} รายการ`
            });
        }

        // Alert: Gas tank low levels
        for (const station of gasStations) {
            const stationGauges = latestGaugeReadings.filter(g => g.stationId === station.id);
            for (const gauge of stationGauges) {
                const percentage = Number(gauge.percentage);
                const alertLevel = station.gasStockAlert ? Number(station.gasStockAlert) : 20; // Default 20%
                if (percentage < alertLevel) {
                    alerts.push({
                        type: 'gas',
                        severity: percentage < 10 ? 'critical' : 'warning',
                        message: `⛽ ${station.name} ถังที่ ${gauge.tankNumber}: แก๊สเหลือ ${percentage.toFixed(0)}% (ต่ำกว่า ${alertLevel}%)`
                    });
                }
            }
        }

        // Alert: Transfers without proof
        if (transfersWithoutProof > 0) {
            alerts.push({
                type: 'upload',
                severity: 'warning',
                message: `📷 มีรายการโอนเงิน ${transfersWithoutProof} รายการที่ยังไม่มีหลักฐาน (7 วันล่าสุด)`
            });
        }

        // Alert: Transactions without meter reading
        if (transactionsWithoutMeter > 0) {
            alerts.push({
                type: 'meter',
                severity: 'info',
                message: `🔢 มีรายการวันนี้ ${transactionsWithoutMeter} รายการที่ไม่ได้ระบุหัวจ่าย`
            });
        }

        return NextResponse.json({
            // Existing data
            totalOwners,
            totalTrucks,
            todayTransactions: todayTransactions.length,
            todayAmount,
            todayLiters,
            pendingInvoices: pendingInvoices.length,
            pendingAmount,
            stationStats,
            weeklySales,
            paymentTypeStats,
            topCustomers,
            // New: Comparison data
            yesterdayAmount,
            yesterdayLiters,
            yesterdayTransactions: yesterdayTransactions.length,
            amountPercentChange,
            litersPercentChange,
            countPercentChange,
            // New: Recent transactions feed
            recentTransactions,
            // New: Monthly heat map
            monthlyHeatMap: heatMapData,
            // New: Alerts
            alerts,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
    }
}
