import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok, formatDateBangkok } from '@/lib/date-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'daily';
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Set date range using Bangkok timezone
        const endStr = endDateParam || getTodayBangkok();
        const end = getEndOfDayBangkok(endStr);

        let startStr = getTodayBangkok();
        if (startDateParam) {
            startStr = startDateParam;
        } else {
            // Default ranges based on type
            const today = new Date();
            if (type === 'daily') {
                today.setDate(today.getDate() - 30);
            } else if (type === 'monthly') {
                today.setMonth(today.getMonth() - 12);
            } else if (type === 'debt') {
                startStr = '2020-01-01';
            }
            if (type !== 'debt') {
                startStr = today.toISOString().split('T')[0];
            }
        }
        const start = getStartOfDayBangkok(startStr);

        if (type === 'daily') {
            // Daily sales report
            const transactions = await prisma.transaction.findMany({
                where: {
                    date: { gte: start, lte: end }
                },
                select: {
                    date: true,
                    amount: true,
                    liters: true,
                    paymentType: true,
                    station: { select: { name: true } }
                },
                orderBy: { date: 'desc' }
            });

            // Group by date
            const grouped: Record<string, {
                date: string;
                totalAmount: number;
                totalLiters: number;
                transactionCount: number;
                cashAmount: number;
                creditAmount: number;
            }> = {};

            transactions.forEach(t => {
                const dateKey = new Date(t.date).toISOString().split('T')[0];
                if (!grouped[dateKey]) {
                    grouped[dateKey] = {
                        date: dateKey,
                        totalAmount: 0,
                        totalLiters: 0,
                        transactionCount: 0,
                        cashAmount: 0,
                        creditAmount: 0
                    };
                }
                grouped[dateKey].totalAmount += Number(t.amount);
                grouped[dateKey].totalLiters += Number(t.liters);
                grouped[dateKey].transactionCount += 1;
                if (t.paymentType === 'CASH') {
                    grouped[dateKey].cashAmount += Number(t.amount);
                } else if (t.paymentType === 'CREDIT') {
                    grouped[dateKey].creditAmount += Number(t.amount);
                }
            });

            const data = Object.values(grouped).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Calculate summary
            const summary = {
                totalAmount: data.reduce((s, d) => s + d.totalAmount, 0),
                totalLiters: data.reduce((s, d) => s + d.totalLiters, 0),
                totalTransactions: data.reduce((s, d) => s + d.transactionCount, 0),
                totalCash: data.reduce((s, d) => s + d.cashAmount, 0),
                totalCredit: data.reduce((s, d) => s + d.creditAmount, 0),
                dateRange: { start: start.toISOString(), end: end.toISOString() }
            };

            return NextResponse.json({ type: 'daily', data, summary });

        } else if (type === 'monthly') {
            // Monthly sales report
            const transactions = await prisma.transaction.findMany({
                where: {
                    date: { gte: start, lte: end }
                },
                select: {
                    date: true,
                    amount: true,
                    liters: true
                }
            });

            // Group by month
            const grouped: Record<string, {
                month: string;
                totalAmount: number;
                totalLiters: number;
                transactionCount: number;
            }> = {};

            transactions.forEach(t => {
                const date = new Date(t.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!grouped[monthKey]) {
                    grouped[monthKey] = {
                        month: monthKey,
                        totalAmount: 0,
                        totalLiters: 0,
                        transactionCount: 0
                    };
                }
                grouped[monthKey].totalAmount += Number(t.amount);
                grouped[monthKey].totalLiters += Number(t.liters);
                grouped[monthKey].transactionCount += 1;
            });

            const data = Object.values(grouped).sort((a, b) =>
                b.month.localeCompare(a.month)
            );

            return NextResponse.json({ type: 'monthly', data });

        } else if (type === 'debt') {
            // Debt/Credit report
            const pendingTransactions = await prisma.transaction.findMany({
                where: {
                    paymentType: 'CREDIT',
                    invoiceId: null
                },
                select: {
                    id: true,
                    date: true,
                    amount: true,
                    liters: true,
                    licensePlate: true,
                    owner: {
                        select: { id: true, name: true, code: true }
                    },
                    station: { select: { name: true } }
                },
                orderBy: { date: 'desc' }
            });

            // Group by owner
            const grouped: Record<string, {
                ownerId: string;
                ownerName: string;
                ownerCode: string | null;
                totalAmount: number;
                totalLiters: number;
                transactionCount: number;
                oldestDate: Date;
            }> = {};

            pendingTransactions.forEach(t => {
                if (t.owner) {
                    if (!grouped[t.owner.id]) {
                        grouped[t.owner.id] = {
                            ownerId: t.owner.id,
                            ownerName: t.owner.name,
                            ownerCode: t.owner.code,
                            totalAmount: 0,
                            totalLiters: 0,
                            transactionCount: 0,
                            oldestDate: new Date(t.date)
                        };
                    }
                    grouped[t.owner.id].totalAmount += Number(t.amount);
                    grouped[t.owner.id].totalLiters += Number(t.liters);
                    grouped[t.owner.id].transactionCount += 1;
                    if (new Date(t.date) < grouped[t.owner.id].oldestDate) {
                        grouped[t.owner.id].oldestDate = new Date(t.date);
                    }
                }
            });

            const data = Object.values(grouped)
                .map(d => ({
                    ...d,
                    daysPending: Math.floor((Date.now() - d.oldestDate.getTime()) / (1000 * 60 * 60 * 24))
                }))
                .sort((a, b) => b.totalAmount - a.totalAmount);

            const summary = {
                totalDebt: data.reduce((s, d) => s + d.totalAmount, 0),
                totalCustomers: data.length,
                totalTransactions: data.reduce((s, d) => s + d.transactionCount, 0)
            };

            return NextResponse.json({ type: 'debt', data, summary });

        } else if (type === 'station') {
            // Station comparison report
            const transactions = await prisma.transaction.findMany({
                where: {
                    date: { gte: start, lte: end }
                },
                select: {
                    amount: true,
                    liters: true,
                    paymentType: true,
                    station: { select: { id: true, name: true } }
                }
            });

            // Group by station
            const grouped: Record<string, {
                stationId: string;
                stationName: string;
                totalAmount: number;
                totalLiters: number;
                transactionCount: number;
                cashAmount: number;
                creditAmount: number;
            }> = {};

            transactions.forEach(t => {
                if (!grouped[t.station.id]) {
                    grouped[t.station.id] = {
                        stationId: t.station.id,
                        stationName: t.station.name,
                        totalAmount: 0,
                        totalLiters: 0,
                        transactionCount: 0,
                        cashAmount: 0,
                        creditAmount: 0
                    };
                }
                grouped[t.station.id].totalAmount += Number(t.amount);
                grouped[t.station.id].totalLiters += Number(t.liters);
                grouped[t.station.id].transactionCount += 1;
                if (t.paymentType === 'CASH') {
                    grouped[t.station.id].cashAmount += Number(t.amount);
                } else if (t.paymentType === 'CREDIT') {
                    grouped[t.station.id].creditAmount += Number(t.amount);
                }
            });

            const data = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);

            return NextResponse.json({ type: 'station', data });

        } else if (type === 'gas') {
            // Gas Station Report
            const stationFilter = searchParams.get('stationId');

            // Get gas transactions
            const gasTransactions = await prisma.transaction.findMany({
                where: {
                    date: { gte: start, lte: end },
                    productType: 'LPG',
                    ...(stationFilter && { stationId: stationFilter })
                },
                select: {
                    date: true,
                    amount: true,
                    liters: true,
                    paymentType: true,
                    station: { select: { id: true, name: true } }
                },
                orderBy: { date: 'desc' }
            });

            // Get gas supplies
            const gasSupplies = await prisma.gasSupply.findMany({
                where: {
                    date: { gte: start, lte: end },
                    ...(stationFilter && { stationId: stationFilter })
                },
                select: {
                    id: true,
                    date: true,
                    liters: true,
                    totalCost: true,
                    station: { select: { id: true, name: true } }
                }
            });

            // Group by date
            const dailyData: Record<string, {
                date: string;
                salesLiters: number;
                salesAmount: number;
                suppliesLiters: number;
                supplyCount: number;
                transactionCount: number;
                cashAmount: number;
                creditAmount: number;
                cardAmount: number;
                transferAmount: number;
                boxTruckAmount: number;
            }> = {};

            gasTransactions.forEach(t => {
                const dateKey = new Date(t.date).toISOString().split('T')[0];
                if (!dailyData[dateKey]) {
                    dailyData[dateKey] = {
                        date: dateKey,
                        salesLiters: 0,
                        salesAmount: 0,
                        suppliesLiters: 0,
                        supplyCount: 0,
                        transactionCount: 0,
                        cashAmount: 0,
                        creditAmount: 0,
                        cardAmount: 0,
                        transferAmount: 0,
                        boxTruckAmount: 0
                    };
                }
                dailyData[dateKey].salesLiters += Number(t.liters);
                dailyData[dateKey].salesAmount += Number(t.amount);
                dailyData[dateKey].transactionCount += 1;
                if (t.paymentType === 'CASH') {
                    dailyData[dateKey].cashAmount += Number(t.amount);
                } else if (t.paymentType === 'CREDIT') {
                    dailyData[dateKey].creditAmount += Number(t.amount);
                } else if (t.paymentType === 'CREDIT_CARD') {
                    dailyData[dateKey].cardAmount += Number(t.amount);
                } else if (t.paymentType === 'TRANSFER') {
                    dailyData[dateKey].transferAmount += Number(t.amount);
                } else if (t.paymentType === 'BOX_TRUCK') {
                    dailyData[dateKey].boxTruckAmount += Number(t.amount);
                }
            });

            gasSupplies.forEach(s => {
                const dateKey = new Date(s.date).toISOString().split('T')[0];
                if (!dailyData[dateKey]) {
                    dailyData[dateKey] = {
                        date: dateKey,
                        salesLiters: 0,
                        salesAmount: 0,
                        suppliesLiters: 0,
                        supplyCount: 0,
                        transactionCount: 0,
                        cashAmount: 0,
                        creditAmount: 0,
                        cardAmount: 0,
                        transferAmount: 0,
                        boxTruckAmount: 0
                    };
                }
                dailyData[dateKey].suppliesLiters += Number(s.liters);
                dailyData[dateKey].supplyCount += 1;
            });

            const data = Object.values(dailyData).sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Summary with more detailed stats
            const totalSupplyCount = gasSupplies.length;
            const summary = {
                totalSalesLiters: data.reduce((s, d) => s + d.salesLiters, 0),
                totalSalesAmount: data.reduce((s, d) => s + d.salesAmount, 0),
                totalSuppliesLiters: data.reduce((s, d) => s + d.suppliesLiters, 0),
                totalSupplyCount,
                totalTransactions: data.reduce((s, d) => s + d.transactionCount, 0),
                totalCash: data.reduce((s, d) => s + d.cashAmount, 0),
                totalCredit: data.reduce((s, d) => s + d.creditAmount, 0),
                totalCard: data.reduce((s, d) => s + d.cardAmount, 0),
                totalTransfer: data.reduce((s, d) => s + d.transferAmount, 0),
                totalBoxTruck: data.reduce((s, d) => s + d.boxTruckAmount, 0),
                daysWithData: data.length,
                dateRange: { start: start.toISOString(), end: end.toISOString() }
            };

            // Get current stock for each station - UNIQUE by name to avoid duplicates
            const stations = await prisma.station.findMany({
                where: { type: 'GAS' },
                distinct: ['name']
            });

            const stockData = await Promise.all(stations.map(async (station) => {
                const totalSupplies = await prisma.gasSupply.aggregate({
                    where: { stationId: station.id },
                    _sum: { liters: true }
                });
                const totalSales = await prisma.transaction.aggregate({
                    where: { stationId: station.id, productType: 'LPG' },
                    _sum: { liters: true }
                });
                return {
                    stationId: station.id,
                    stationName: station.name,
                    currentStock: Number(totalSupplies._sum.liters || 0) - Number(totalSales._sum.liters || 0),
                    alertLevel: Number(station.gasStockAlert || 1000)
                };
            }));

            // Remove duplicates based on station name
            const uniqueStockData = stockData.filter((item, index, self) =>
                index === self.findIndex(t => t.stationName === item.stationName)
            );

            return NextResponse.json({ type: 'gas', data, summary, stockData: uniqueStockData });
        }

        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });

    } catch (error) {
        console.error('Reports error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
