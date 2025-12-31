import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { VarianceStatus } from '@prisma/client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();

        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // 1. Get all stations
        const stations = await prisma.station.findMany({
            select: { id: true, name: true, type: true }
        });

        // 2. Get daily records with shifts for today
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                station: { select: { id: true, name: true } },
                shifts: {
                    include: {
                        reconciliation: true,
                        meters: true,
                        staff: { select: { name: true } }
                    }
                }
            }
        });

        // 3. Calculate KPIs from transactions
        const todayTransactions = await prisma.transaction.findMany({
            where: {
                date: { gte: startOfDay, lte: endOfDay }
            },
            select: {
                amount: true,
                liters: true,
                paymentType: true,
                stationId: true
            }
        });

        // 4. Get payments summary by type
        const cashTotal = todayTransactions
            .filter(t => t.paymentType === 'CASH')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const transferTotal = todayTransactions
            .filter(t => t.paymentType === 'TRANSFER')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const creditTotal = todayTransactions
            .filter(t => t.paymentType === 'CREDIT')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        // 5. Calculate shift status from reconciliations
        let greenCount = 0;
        let yellowCount = 0;
        let redCount = 0;
        let totalShifts = 0;
        let varianceAbsTotal = 0;
        let expectedAmountTotal = 0;
        let fuelLitersTotal = 0;

        dailyRecords.forEach(record => {
            record.shifts.forEach(shift => {
                if (shift.status === 'LOCKED' || shift.status === 'CLOSED') {
                    totalShifts++;
                    if (shift.reconciliation) {
                        const recon = shift.reconciliation;
                        expectedAmountTotal += Number(recon.totalExpected);
                        varianceAbsTotal += Math.abs(Number(recon.variance));

                        if (recon.varianceStatus === VarianceStatus.GREEN) greenCount++;
                        else if (recon.varianceStatus === VarianceStatus.YELLOW) yellowCount++;
                        else if (recon.varianceStatus === VarianceStatus.RED) redCount++;
                    }
                    // Sum liters from meters
                    fuelLitersTotal += shift.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0);
                }
            });
        });

        // 6. AR Aging Calculation
        const pendingInvoices = await prisma.invoice.findMany({
            where: { status: { in: ['PENDING', 'PARTIAL'] } },
            select: {
                id: true,
                totalAmount: true,
                paidAmount: true,
                createdAt: true,
                owner: { select: { name: true } }
            }
        });

        let arOutstandingTotal = 0;
        const aging: Record<string, number> = {
            '0_7': 0,
            '8_15': 0,
            '16_30': 0,
            '31_plus': 0
        };

        pendingInvoices.forEach(inv => {
            const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
            if (balance <= 0) return;

            arOutstandingTotal += balance;
            const daysSince = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));

            if (daysSince <= 7) aging['0_7'] += balance;
            else if (daysSince <= 15) aging['8_15'] += balance;
            else if (daysSince <= 30) aging['16_30'] += balance;
            else aging['31_plus'] += balance;
        });

        // 7. Build station list with KPIs
        const stationList = stations.map(station => {
            const record = dailyRecords.find(r => r.station.id === station.id);

            let stationGreen = 0, stationYellow = 0, stationRed = 0;
            let stationExpected = 0, stationLiters = 0;
            let lastClosedAtStr: string | null = null;
            let lastVarianceStatus: string | null = null;

            if (record) {
                record.shifts.forEach(shift => {
                    if (shift.status === 'LOCKED' || shift.status === 'CLOSED') {
                        if (shift.reconciliation) {
                            const vs = shift.reconciliation.varianceStatus;
                            if (vs === VarianceStatus.GREEN) stationGreen++;
                            else if (vs === VarianceStatus.YELLOW) stationYellow++;
                            else if (vs === VarianceStatus.RED) stationRed++;
                            stationExpected += Number(shift.reconciliation.totalExpected);
                            lastVarianceStatus = vs;
                        }
                        stationLiters += shift.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0);
                        if (shift.closedAt) {
                            const closedStr = shift.closedAt.toISOString();
                            if (!lastClosedAtStr || closedStr > lastClosedAtStr) {
                                lastClosedAtStr = closedStr;
                            }
                        }
                    }
                });
            }

            return {
                station_id: station.id,
                station_name: station.name,
                fuel_liters_total: Math.round(stationLiters * 100) / 100,
                expected_amount_total: Math.round(stationExpected * 100) / 100,
                shift_status: {
                    green: stationGreen,
                    yellow: stationYellow,
                    red: stationRed
                },
                last_closed_at: lastClosedAtStr,
                last_variance_status: lastVarianceStatus
            };
        });

        return NextResponse.json({
            date: dateStr,
            kpis: {
                fuel_liters_total: Math.round(fuelLitersTotal * 100) / 100,
                expected_amount_total: Math.round(expectedAmountTotal * 100) / 100,
                shop_total: Math.round((cashTotal + transferTotal) * 100) / 100,
                variance_abs_total: Math.round(varianceAbsTotal * 100) / 100
            },
            shift_status: {
                total: totalShifts,
                green: greenCount,
                yellow: yellowCount,
                red: redCount
            },
            payments_today: {
                cash: Math.round(cashTotal * 100) / 100,
                transfer: Math.round(transferTotal * 100) / 100,
                credit: Math.round(creditTotal * 100) / 100,
                total: Math.round((cashTotal + transferTotal + creditTotal) * 100) / 100
            },
            ar: {
                outstanding_total: Math.round(arOutstandingTotal * 100) / 100,
                aging
            },
            stations: stationList
        });
    } catch (error) {
        console.error('Executive dashboard error:', error);
        return NextResponse.json({ error: 'Failed to fetch executive dashboard' }, { status: 500 });
    }
}
