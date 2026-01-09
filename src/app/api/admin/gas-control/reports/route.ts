import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '@/lib/date-utils';
import type { ReportType, ShiftSummaryReport, DailyReport, StaffPerformanceReport } from '@/types/gas-control';
import { getGasStationDbId, getGasStationName } from '@/types/gas-control';

// POST: Generate report
export async function POST(request: NextRequest) {
    try {
        // Check admin session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: { select: { role: true } } }
        });

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { type, stationId: stationIdParam, startDate, endDate, staffId } = body as {
            type: ReportType;
            stationId: string;
            startDate: string;
            endDate: string;
            staffId?: string;
        };

        if (!type || !stationIdParam || !startDate) {
            return NextResponse.json({
                error: 'Required: type, stationId, startDate'
            }, { status: 400 });
        }

        // Convert station-5/station-6 to actual database UUID  
        const stationId = getGasStationDbId(stationIdParam);
        const stationName = getGasStationName(stationIdParam);

        const start = getStartOfDayBangkok(startDate);
        const end = getEndOfDayBangkok(endDate || startDate);

        switch (type) {
            case 'shift-summary':
                return generateShiftSummary(stationName, stationId, startDate, start, end);
            case 'daily':
                return generateDailyReport(stationName, stationId, startDate, endDate || startDate, start, end);
            case 'staff-performance':
                return generateStaffPerformance(stationName, stationId, startDate, endDate || startDate, start, end, staffId);
            default:
                return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
        }
    } catch (error) {
        console.error('[Gas Control Reports]:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}

async function generateShiftSummary(
    stationName: string,
    stationId: string,
    dateStr: string,
    start: Date,
    end: Date
) {
    const dailyRecord = await prisma.dailyRecord.findFirst({
        where: {
            stationId,
            date: start
        },
        include: {
            shifts: {
                include: {
                    staff: { select: { name: true } },
                    meters: true,
                    reconciliation: true
                },
                orderBy: { shiftNumber: 'asc' }
            }
        }
    });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
        where: {
            stationId,
            date: { gte: start, lte: end },
            isVoided: false,
            deletedAt: null
        }
    });

    const shiftData = dailyRecord?.shifts.map(shift => {
        const meterLiters = shift.meters.reduce((sum, m) => {
            return sum + (m.endReading ? Number(m.endReading) - Number(m.startReading) : 0);
        }, 0);

        const transactionLiters = transactions.reduce((sum, t) => sum + Number(t.liters), 0) / (dailyRecord?.shifts.length || 1);

        // Calculate by payment type
        const cashSales = transactions
            .filter(t => t.paymentType === 'CASH')
            .reduce((sum, t) => sum + Number(t.amount), 0) / (dailyRecord?.shifts.length || 1);
        const creditSales = transactions
            .filter(t => t.paymentType === 'CREDIT')
            .reduce((sum, t) => sum + Number(t.amount), 0) / (dailyRecord?.shifts.length || 1);
        const transferSales = transactions
            .filter(t => t.paymentType === 'TRANSFER')
            .reduce((sum, t) => sum + Number(t.amount), 0) / (dailyRecord?.shifts.length || 1);

        return {
            shiftNumber: shift.shiftNumber,
            shiftName: shift.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
            staffName: shift.staff?.name || '-',
            openTime: shift.createdAt.toISOString(),
            closeTime: shift.closedAt?.toISOString() || null,
            totalSales: shift.reconciliation ? Number(shift.reconciliation.totalReceived) : 0,
            cashSales,
            creditSales,
            transferSales,
            meterLiters,
            transactionLiters,
            variance: shift.reconciliation ? Number(shift.reconciliation.variance) : 0,
            transactionCount: Math.floor(transactions.length / (dailyRecord?.shifts.length || 1))
        };
    }) || [];

    const report: ShiftSummaryReport = {
        stationName,
        date: dateStr,
        shifts: shiftData,
        totals: {
            totalSales: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
            totalLiters: transactions.reduce((sum, t) => sum + Number(t.liters), 0),
            totalTransactions: transactions.length
        }
    };

    return NextResponse.json({ report });
}

async function generateDailyReport(
    stationName: string,
    stationId: string,
    startDate: string,
    endDate: string,
    start: Date,
    end: Date
) {
    const dailyRecords = await prisma.dailyRecord.findMany({
        where: {
            stationId,
            date: { gte: start, lte: end }
        },
        include: {
            shifts: true
        },
        orderBy: { date: 'asc' }
    });

    const transactions = await prisma.transaction.findMany({
        where: {
            stationId,
            date: { gte: start, lte: end },
            isVoided: false,
            deletedAt: null
        }
    });

    // Group transactions by date
    const txByDate = new Map<string, { sales: number; liters: number; count: number }>();
    for (const t of transactions) {
        const dateKey = t.date.toISOString().split('T')[0];
        const existing = txByDate.get(dateKey) || { sales: 0, liters: 0, count: 0 };
        existing.sales += Number(t.amount);
        existing.liters += Number(t.liters);
        existing.count += 1;
        txByDate.set(dateKey, existing);
    }

    const days = dailyRecords.map(record => {
        const dateKey = record.date.toISOString().split('T')[0];
        const txData = txByDate.get(dateKey) || { sales: 0, liters: 0, count: 0 };
        return {
            date: dateKey,
            totalSales: txData.sales,
            totalLiters: txData.liters,
            transactionCount: txData.count,
            shiftCount: record.shifts.length
        };
    });

    const totalSales = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalLiters = transactions.reduce((sum, t) => sum + Number(t.liters), 0);

    const report: DailyReport = {
        stationName,
        startDate,
        endDate,
        days,
        totals: {
            totalSales,
            totalLiters,
            totalTransactions: transactions.length,
            averageDailySales: days.length > 0 ? totalSales / days.length : 0
        }
    };

    return NextResponse.json({ report });
}

async function generateStaffPerformance(
    stationName: string,
    stationId: string,
    startDate: string,
    endDate: string,
    start: Date,
    end: Date,
    staffId?: string
) {
    const shifts = await prisma.shift.findMany({
        where: {
            dailyRecord: {
                stationId,
                date: { gte: start, lte: end }
            },
            ...(staffId && { staffId })
        },
        include: {
            staff: { select: { id: true, name: true } },
            reconciliation: true
        }
    });

    // Group by staff
    const staffMap = new Map<string, {
        staffId: string;
        staffName: string;
        shiftsWorked: number;
        totalSales: number;
        transactionCount: number;
    }>();

    for (const shift of shifts) {
        if (!shift.staffId) continue;
        const existing = staffMap.get(shift.staffId) || {
            staffId: shift.staffId,
            staffName: shift.staff?.name || '-',
            shiftsWorked: 0,
            totalSales: 0,
            transactionCount: 0
        };
        existing.shiftsWorked += 1;
        existing.totalSales += shift.reconciliation ? Number(shift.reconciliation.totalReceived) : 0;
        staffMap.set(shift.staffId, existing);
    }

    const staffData = Array.from(staffMap.values()).map(s => ({
        ...s,
        averageSalesPerShift: s.shiftsWorked > 0 ? s.totalSales / s.shiftsWorked : 0
    }));

    const report: StaffPerformanceReport = {
        stationName,
        startDate,
        endDate,
        staff: staffData
    };

    return NextResponse.json({ report });
}
