import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

// GET: Fetch existing shift data for a specific date/station/shift
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const dateStr = searchParams.get('date');
        const shiftNumber = parseInt(searchParams.get('shiftNumber') || '1');

        if (!stationId || !dateStr) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Verify it's a GAS station
        const station = STATIONS.find(s => s.id === stationId && s.type === 'GAS');
        if (!station) {
            return NextResponse.json({ error: 'Invalid gas station' }, { status: 400 });
        }

        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        // Find daily record and shift
        const dailyRecord = await prisma.dailyRecord.findUnique({
            where: {
                stationId_date: { stationId, date }
            },
            include: {
                shifts: {
                    where: { shiftNumber },
                    include: {
                        meters: true,
                        staff: { select: { name: true } }
                    }
                },
                gaugeReadings: {
                    where: { shiftNumber }
                }
            }
        });

        if (!dailyRecord || dailyRecord.shifts.length === 0) {
            return NextResponse.json({
                exists: false,
                meters: [1, 2, 3, 4].map(n => ({ nozzle: n, start: null, end: null })),
                gauges: [1, 2, 3].map(t => ({ tank: t, percentage: null })),
                sales: { cash: 0, credit: 0, card: 0, transfer: 0 }
            });
        }

        const shift = dailyRecord.shifts[0];

        // Get meters
        const meters = [1, 2, 3, 4].map(nozzle => {
            const meter = shift.meters.find(m => m.nozzleNumber === nozzle);
            return {
                nozzle,
                start: meter?.startReading ? Number(meter.startReading) : null,
                end: meter?.endReading ? Number(meter.endReading) : null
            };
        });

        // Get gauges
        const gauges = [1, 2, 3].map(tank => {
            const gauge = dailyRecord.gaugeReadings.find(g => g.tankNumber === tank);
            return {
                tank,
                percentage: gauge?.percentage ? Number(gauge.percentage) : null
            };
        });

        // Get sales from transactions
        const transactions = await prisma.transaction.groupBy({
            by: ['paymentType'],
            where: {
                stationId,
                dailyRecordId: dailyRecord.id,
                createdAt: {
                    gte: new Date(date.getTime()),
                    lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            _sum: { amount: true }
        });

        const sales = {
            cash: 0,
            credit: 0,
            card: 0,
            transfer: 0
        };

        transactions.forEach(tx => {
            const amount = Number(tx._sum.amount) || 0;
            if (tx.paymentType === 'CASH') sales.cash = amount;
            else if (tx.paymentType === 'CREDIT') sales.credit = amount;
            else if (tx.paymentType === 'CREDIT_CARD') sales.card = amount;
            else if (tx.paymentType === 'TRANSFER') sales.transfer = amount;
        });

        return NextResponse.json({
            exists: true,
            shiftId: shift.id,
            meters,
            gauges,
            sales
        });
    } catch (error) {
        console.error('Error fetching data entry:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST: Save shift data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { stationId, date: dateStr, shiftNumber, meters, gauges, sales } = body;

        if (!stationId || !dateStr || !shiftNumber) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Verify it's a GAS station
        const station = STATIONS.find(s => s.id === stationId && s.type === 'GAS');
        if (!station) {
            return NextResponse.json({ error: 'Invalid gas station' }, { status: 400 });
        }

        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        // Upsert daily record
        let dailyRecord = await prisma.dailyRecord.upsert({
            where: {
                stationId_date: { stationId, date }
            },
            create: {
                stationId,
                date,
                retailPrice: 16.09, // Gas price
                wholesalePrice: 16.09,
                status: 'OPEN'
            },
            update: {}
        });

        // Upsert shift
        let shift = await prisma.shift.findFirst({
            where: {
                dailyRecordId: dailyRecord.id,
                shiftNumber
            }
        });

        if (!shift) {
            shift = await prisma.shift.create({
                data: {
                    dailyRecordId: dailyRecord.id,
                    shiftNumber,
                    status: 'CLOSED' // Historical data is closed
                }
            });
        }

        // Upsert meter readings
        for (const meter of meters) {
            if (meter.start !== null || meter.end !== null) {
                await prisma.meterReading.upsert({
                    where: {
                        shiftId_nozzleNumber: {
                            shiftId: shift.id,
                            nozzleNumber: meter.nozzle
                        }
                    },
                    create: {
                        shiftId: shift.id,
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: meter.nozzle,
                        startReading: meter.start ?? 0,
                        endReading: meter.end,
                        soldQty: meter.start !== null && meter.end !== null
                            ? Math.max(0, meter.end - meter.start)
                            : null
                    },
                    update: {
                        startReading: meter.start ?? 0,
                        endReading: meter.end,
                        soldQty: meter.start !== null && meter.end !== null
                            ? Math.max(0, meter.end - meter.start)
                            : null
                    }
                });
            }
        }

        // Upsert gauge readings
        for (const gauge of gauges) {
            if (gauge.percentage !== null) {
                // Delete existing gauge for this tank/shift if any
                await prisma.gaugeReading.deleteMany({
                    where: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        tankNumber: gauge.tank,
                        shiftNumber
                    }
                });

                // Create new gauge reading
                await prisma.gaugeReading.create({
                    data: {
                        stationId,
                        dailyRecordId: dailyRecord.id,
                        date,
                        tankNumber: gauge.tank,
                        percentage: gauge.percentage,
                        shiftNumber
                    }
                });
            }
        }

        // Note: Sales would require creating individual transactions
        // For now, we just save the summary as a note or separate logic
        // TODO: Add sales transaction creation if needed

        return NextResponse.json({
            success: true,
            shiftId: shift.id,
            message: 'บันทึกข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Error saving data entry:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
