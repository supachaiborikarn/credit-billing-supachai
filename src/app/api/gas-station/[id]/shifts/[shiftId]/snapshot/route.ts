import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';

/**
 * GET /api/gas-station/[id]/shifts/[shiftId]/snapshot
 * 
 * Returns complete snapshot of a shift including:
 * - shift info (id, number, status, staff, times)
 * - meters (nozzle readings with liters & amounts)
 * - gauges (tank percentages start/end)
 * - transactions (all for this shift)
 * - stock (opening, sales, supplies, closing)
 * - summary (expected vs received, variance)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shiftId: string }> }
) {
    try {
        const { id, shiftId } = await params;
        const stationId = `station-${id}`;

        // Get shift with meters
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                staff: { select: { id: true, name: true } },
                meters: { orderBy: { nozzleNumber: 'asc' } },
                dailyRecord: {
                    select: {
                        id: true,
                        date: true,
                        gasPrice: true,
                        stationId: true,
                    }
                },
            }
        });

        if (!shift) {
            return HttpErrors.notFound('ไม่พบกะนี้');
        }

        // Verify station match
        if (shift.dailyRecord.stationId !== stationId) {
            return HttpErrors.notFound('กะไม่ตรงกับสถานี');
        }

        const gasPrice = Number(shift.dailyRecord.gasPrice) || 16.09;
        const LITERS_PER_PERCENT = 98;

        // Calculate meter data with amounts
        const meters = shift.meters.map(m => {
            const start = Number(m.startReading) || 0;
            const end = m.endReading ? Number(m.endReading) : null;
            const liters = end !== null ? end - start : null;
            const amount = liters !== null ? liters * gasPrice : null;

            return {
                nozzleNumber: m.nozzleNumber,
                startReading: start,
                endReading: end,
                liters,
                amount,
            };
        });

        const totalLiters = meters
            .filter(m => m.liters !== null)
            .reduce((sum, m) => sum + (m.liters || 0), 0);

        const totalMeterAmount = meters
            .filter(m => m.amount !== null)
            .reduce((sum, m) => sum + (m.amount || 0), 0);

        // Get gauge readings for this shift
        const gaugeReadings = await prisma.gaugeReading.findMany({
            where: {
                stationId,
                dailyRecordId: shift.dailyRecordId,
                shiftNumber: shift.shiftNumber,
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group gauges by tank and type
        const gauges = [1, 2, 3].map(tankNumber => {
            const tankReadings = gaugeReadings.filter(g => g.tankNumber === tankNumber);
            const startReading = tankReadings.find(g => g.notes === 'start');
            const endReading = tankReadings.find(g => g.notes === 'end');

            return {
                tankNumber,
                startPercentage: startReading ? Number(startReading.percentage) : null,
                endPercentage: endReading ? Number(endReading.percentage) : null,
                startPhoto: startReading?.photoUrl || null,
                endPhoto: endReading?.photoUrl || null,
            };
        });

        // Calculate stock from gauges
        const openingStock = gauges
            .filter(g => g.startPercentage !== null)
            .reduce((sum, g) => sum + (g.startPercentage || 0) * LITERS_PER_PERCENT, 0);

        const closingStock = gauges
            .filter(g => g.endPercentage !== null)
            .reduce((sum, g) => sum + (g.endPercentage || 0) * LITERS_PER_PERCENT, 0);

        // Get transactions for this shift (filter by dailyRecordId since Transaction doesn't have shiftNumber)
        // For now, get all transactions for the daily record
        const transactions = await prisma.transaction.findMany({
            where: {
                stationId,
                dailyRecordId: shift.dailyRecordId,
                deletedAt: null,
            },
            include: {
                owner: { select: { name: true } }
            },
            orderBy: { date: 'asc' }
        });

        const formattedTransactions = transactions.map(t => ({
            id: t.id,
            date: t.date.toISOString(),
            licensePlate: t.licensePlate,
            ownerName: t.owner?.name || t.ownerName,
            paymentType: t.paymentType,
            productType: t.productType,
            liters: Number(t.liters),
            pricePerLiter: Number(t.pricePerLiter),
            amount: Number(t.amount),
        }));

        // Calculate transaction totals by payment type
        const transactionTotals = {
            cash: 0,
            credit: 0,
            transfer: 0,
            boxTruck: 0,
            total: 0,
        };

        for (const t of transactions) {
            const amount = Number(t.amount);
            transactionTotals.total += amount;
            switch (t.paymentType) {
                case 'CASH':
                    transactionTotals.cash += amount;
                    break;
                case 'CREDIT':
                    transactionTotals.credit += amount;
                    break;
                case 'TRANSFER':
                    transactionTotals.transfer += amount;
                    break;
                case 'BOX_TRUCK':
                    transactionTotals.boxTruck += amount;
                    break;
            }
        }

        // Get gas supplies for this day
        const supplyDateStart = new Date(shift.dailyRecord.date);
        const supplyDateEnd = new Date(supplyDateStart);
        supplyDateEnd.setHours(23, 59, 59, 999);

        const supplies = await prisma.gasSupply.findMany({
            where: {
                stationId,
                date: { gte: supplyDateStart, lte: supplyDateEnd },
            },
            orderBy: { date: 'desc' }
        });

        const totalSupplies = supplies.reduce((sum, s) => sum + Number(s.liters), 0);

        // Calculate summary
        const totalExpected = totalMeterAmount;
        const totalReceived = transactionTotals.total;
        const variance = totalReceived - totalExpected;
        const varianceStatus = Math.abs(variance) <= 200 ? 'GREEN' : Math.abs(variance) <= 500 ? 'YELLOW' : 'RED';

        return NextResponse.json({
            shift: {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                status: shift.status,
                staffId: shift.staff?.id,
                staffName: shift.staff?.name || '-',
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                date: shift.dailyRecord.date.toISOString().split('T')[0],
                gasPrice,
            },
            meters,
            meterTotals: {
                totalLiters,
                totalAmount: totalMeterAmount,
            },
            gauges,
            stock: {
                opening: openingStock,
                sales: totalLiters,
                supplies: totalSupplies,
                closing: closingStock,
                calculated: openingStock - totalLiters + totalSupplies,
                variance: closingStock === 0 ? null : closingStock - (openingStock - totalLiters + totalSupplies),
            },
            transactions: formattedTransactions,
            transactionTotals,
            summary: {
                totalExpected,
                totalReceived,
                variance,
                varianceStatus,
                variancePercent: totalExpected > 0 ? ((variance / totalExpected) * 100).toFixed(2) : '0',
            }
        });
    } catch (error) {
        console.error('[Shift Snapshot]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
