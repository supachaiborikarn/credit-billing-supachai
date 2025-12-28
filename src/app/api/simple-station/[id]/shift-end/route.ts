import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET - Fetch shift end data
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

        // Find or create daily record
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: {
                    gte: date,
                    lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            include: {
                shifts: {
                    include: {
                        staff: { select: { name: true } },
                        meters: true
                    },
                    orderBy: { shiftNumber: 'asc' }
                },
                transactions: {
                    where: { deletedAt: null, isVoided: false }
                }
            }
        });

        // Get station fuel config (or use defaults)
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: { gasPrice: true, type: true }
        });

        // Get products for this station
        const products = await prisma.productInventory.findMany({
            where: { stationId },
            include: { product: true }
        });

        // Default fuel configuration
        const fuelConfig = [
            { nozzle: 1, name: 'ดีเซล B7', price: 30.84 },
            { nozzle: 2, name: 'ดีเซล B7', price: 30.84 },
            { nozzle: 3, name: 'แก๊สโซฮอล์ 91', price: 31.75 },
            { nozzle: 4, name: 'แก๊สโซฮอล์ 95', price: 31.38 },
        ];

        // Get last closed shift's meter readings for carry-over
        const lastClosedShift = await prisma.shift.findFirst({
            where: {
                dailyRecord: { stationId },
                status: { in: ['CLOSED', 'LOCKED'] }
            },
            orderBy: { closedAt: 'desc' },
            include: {
                meters: true
            }
        });

        // Build carry-over readings map (nozzle -> last reading)
        const carryOverReadings: Record<number, number> = {};
        if (lastClosedShift?.meters) {
            for (const m of lastClosedShift.meters) {
                if (m.endReading) {
                    carryOverReadings[m.nozzleNumber] = Number(m.endReading);
                }
            }
        }

        return NextResponse.json({
            dailyRecord,
            shifts: dailyRecord?.shifts.map(s => ({
                id: s.id,
                shiftNumber: s.shiftNumber,
                status: s.status,
                staffName: s.staff?.name,
                createdAt: s.createdAt,
                closedAt: s.closedAt
            })) || [],
            meters: dailyRecord?.shifts.flatMap(s => s.meters) || [],
            transactions: dailyRecord?.transactions || [],
            products: products.map(p => ({
                id: p.productId,
                name: p.product.name,
                price: Number(p.product.salePrice),
                quantity: p.quantity
            })),
            fuelConfig,
            stationType: station?.type,
            carryOverReadings // Send previous shift end readings
        });
    } catch (error) {
        console.error('[Shift End GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST - Submit shift end
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();

        const {
            shiftId,
            meters,
            products,
            cash,
            totalExpected,
            totalReceived,
            variance,
            varianceStatus
        } = body;

        // Get user from session
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        let userId = 'system';
        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                select: { userId: true }
            });
            if (session) userId = session.userId;
        }

        // Validate shift exists and is open
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: { dailyRecord: true }
        });

        if (!shift) {
            return NextResponse.json({ error: 'ไม่พบกะนี้' }, { status: 404 });
        }

        if (shift.status !== 'OPEN') {
            return NextResponse.json({ error: 'กะนี้ปิดไปแล้ว' }, { status: 400 });
        }

        // Save meter readings
        for (const meter of meters) {
            if (meter.endReading > 0) {
                await prisma.meterReading.upsert({
                    where: {
                        shiftId_nozzleNumber: {
                            shiftId,
                            nozzleNumber: meter.nozzleNumber
                        }
                    },
                    create: {
                        shiftId,
                        dailyRecordId: shift.dailyRecordId,
                        nozzleNumber: meter.nozzleNumber,
                        startReading: meter.startReading,
                        endReading: meter.endReading,
                        soldQty: meter.liters,
                        capturedById: userId,
                        capturedAt: new Date()
                    },
                    update: {
                        endReading: meter.endReading,
                        soldQty: meter.liters,
                        capturedById: userId,
                        capturedAt: new Date()
                    }
                });
            }
        }

        // Update product inventory and record sales
        for (const product of products) {
            if (product.sold > 0) {
                // Record sale
                await prisma.productSale.create({
                    data: {
                        productId: product.id,
                        stationId,
                        quantity: product.sold,
                        salePrice: product.price,
                        paymentType: 'CASH',
                        date: new Date()
                    }
                });

                // Update inventory
                await prisma.productInventory.update({
                    where: {
                        productId_stationId: {
                            productId: product.id,
                            stationId
                        }
                    },
                    data: {
                        quantity: product.closingStock
                    }
                });
            }

            // Add received stock
            if (product.received > 0) {
                await prisma.productReceipt.create({
                    data: {
                        productId: product.id,
                        stationId,
                        quantity: product.received,
                        date: new Date()
                    }
                });
            }
        }

        // Create reconciliation record
        await prisma.shiftReconciliation.create({
            data: {
                shiftId,
                expectedFuelAmount: totalExpected - (products?.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0) || 0),
                expectedOtherAmount: products?.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0) || 0,
                totalExpected,
                totalReceived,
                cashReceived: cash.cashReceived || 0,
                creditReceived: cash.cardReceived || 0,
                transferReceived: cash.transferReceived || 0,
                variance,
                varianceStatus: varianceStatus || 'GREEN'
            }
        });

        // Close the shift and save carry-over data
        await prisma.shift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: userId,
                varianceNote: varianceStatus !== 'GREEN' ? `ยอดต่าง ${variance} บาท` : null
            }
        });

        // Save the meter end readings for carry-over to next shift
        // Store in a format that can be retrieved when opening next shift
        const carryOverData = {
            meterReadings: meters.map((m: { nozzleNumber: number; endReading: number }) => ({
                nozzleNumber: m.nozzleNumber,
                lastReading: m.endReading
            })),
            closedShiftId: shiftId,
            closedAt: new Date().toISOString()
        };

        // Update daily record with carry-over data
        await prisma.dailyRecord.update({
            where: { id: shift.dailyRecordId },
            data: {
                // Store carry-over data in metadata (could also use a separate table)
                updatedAt: new Date()
            }
        });

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId,
                action: 'CLOSE',
                model: 'Shift',
                recordId: shiftId,
                newData: {
                    totalExpected,
                    totalReceived,
                    variance,
                    varianceStatus,
                    carryOverMeters: carryOverData.meterReadings
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: '✅ ปิดกะเรียบร้อย',
            varianceStatus
        });
    } catch (error) {
        console.error('[Shift End POST]:', error);
        return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 });
    }
}
