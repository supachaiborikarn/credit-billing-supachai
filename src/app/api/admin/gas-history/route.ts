import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok, formatDateBangkok } from '@/lib/date-utils';
import { cookies } from 'next/headers';

// GET - Fetch gas station historical data
export async function GET(request: NextRequest) {
    try {
        // Check admin auth
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: true }
        });

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId') || 'station-3'; // Default to gas station
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Default to last 30 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date();
        if (!startDate) {
            start.setDate(start.getDate() - 30);
        }

        // Get all daily records in range
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                stationId,
                date: {
                    gte: getStartOfDayBangkok(start.toISOString().split('T')[0]),
                    lte: getEndOfDayBangkok(end.toISOString().split('T')[0]),
                }
            },
            include: {
                meters: true,
                transactions: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        date: true,
                        licensePlate: true,
                        ownerName: true,
                        paymentType: true,
                        liters: true,
                        amount: true,
                    }
                },
                shifts: {
                    include: { meters: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Format the response
        const formattedRecords = dailyRecords.map(record => ({
            id: record.id,
            date: formatDateBangkok(record.date),
            dateRaw: record.date.toISOString(),
            status: record.status,
            gasPrice: record.gasPrice ? Number(record.gasPrice) : null,
            meters: record.meters.map(m => ({
                id: m.id,
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
            })),
            transactions: record.transactions.map(t => ({
                id: t.id,
                date: t.date.toISOString(),
                licensePlate: t.licensePlate || '',
                ownerName: t.ownerName || '',
                paymentType: t.paymentType,
                liters: Number(t.liters),
                amount: Number(t.amount),
            })),
            transactionCount: record.transactions.length,
            totalAmount: record.transactions.reduce((sum, t) => sum + Number(t.amount), 0),
            totalLiters: record.transactions.reduce((sum, t) => sum + Number(t.liters), 0),
            shifts: record.shifts.map(s => ({
                id: s.id,
                shiftNumber: s.shiftNumber,
                status: s.status,
            })),
            isComplete: record.meters.every(m => m.endReading !== null && Number(m.endReading) > 0),
        }));

        return NextResponse.json({
            records: formattedRecords,
            summary: {
                totalDays: formattedRecords.length,
                completeDays: formattedRecords.filter(r => r.isComplete).length,
                incompleteDays: formattedRecords.filter(r => !r.isComplete).length,
                totalTransactions: formattedRecords.reduce((sum, r) => sum + r.transactionCount, 0),
                totalAmount: formattedRecords.reduce((sum, r) => sum + r.totalAmount, 0),
            }
        });
    } catch (error) {
        console.error('Admin gas history GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST - Create or update daily record
export async function POST(request: NextRequest) {
    try {
        // Check admin auth
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: true }
        });

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { stationId, dateStr, gasPrice, meters, action } = body;

        const date = getStartOfDayBangkok(dateStr);

        if (action === 'createRecord') {
            // Create new daily record
            const existingRecord = await prisma.dailyRecord.findUnique({
                where: { stationId_date: { stationId, date } }
            });

            if (existingRecord) {
                return NextResponse.json({ error: 'Record already exists for this date' }, { status: 400 });
            }

            const newRecord = await prisma.dailyRecord.create({
                data: {
                    stationId,
                    date,
                    gasPrice: gasPrice || null,
                    status: 'OPEN',
                    meters: {
                        create: [1, 2, 3, 4].map(nozzle => ({
                            nozzleNumber: nozzle,
                            startReading: 0,
                        }))
                    }
                },
                include: { meters: true }
            });

            // Log audit
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: 'CREATE',
                    model: 'DailyRecord',
                    recordId: newRecord.id,
                    newData: { dateStr, stationId, gasPrice },
                }
            });

            return NextResponse.json({ success: true, record: newRecord });
        }

        if (action === 'updateMeters') {
            // Update meters for existing record
            const record = await prisma.dailyRecord.findUnique({
                where: { stationId_date: { stationId, date } },
                include: { meters: true }
            });

            if (!record) {
                return NextResponse.json({ error: 'Record not found' }, { status: 404 });
            }

            const oldData = record.meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                startReading: Number(m.startReading),
                endReading: m.endReading ? Number(m.endReading) : null,
            }));

            // Update each meter
            for (const meter of meters) {
                const existingMeter = record.meters.find(m => m.nozzleNumber === meter.nozzleNumber);
                if (existingMeter) {
                    await prisma.meterReading.update({
                        where: { id: existingMeter.id },
                        data: {
                            startReading: meter.startReading !== undefined ? meter.startReading : existingMeter.startReading,
                            endReading: meter.endReading !== undefined ? meter.endReading : existingMeter.endReading,
                        }
                    });
                }
            }

            // Log audit
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: 'UPDATE',
                    model: 'MeterReading',
                    recordId: record.id,
                    oldData,
                    newData: meters,
                }
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Admin gas history POST error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

// DELETE - Delete a daily record
export async function DELETE(request: NextRequest) {
    try {
        // Check admin auth
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { user: true }
        });

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const recordId = searchParams.get('recordId');

        if (!recordId) {
            return NextResponse.json({ error: 'Record ID required' }, { status: 400 });
        }

        // Get record for audit
        const record = await prisma.dailyRecord.findUnique({
            where: { id: recordId },
            include: { meters: true, transactions: true }
        });

        if (!record) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        // Check if has transactions
        if (record.transactions.length > 0) {
            return NextResponse.json({
                error: 'Cannot delete record with transactions. Delete transactions first.'
            }, { status: 400 });
        }

        // Delete meters first
        await prisma.meterReading.deleteMany({
            where: { dailyRecordId: recordId }
        });

        // Delete shifts
        await prisma.shift.deleteMany({
            where: { dailyRecordId: recordId }
        });

        // Delete record
        await prisma.dailyRecord.delete({
            where: { id: recordId }
        });

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'DELETE',
                model: 'DailyRecord',
                recordId,
                oldData: {
                    date: record.date.toISOString(),
                    stationId: record.stationId,
                },
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Admin gas history DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
}
