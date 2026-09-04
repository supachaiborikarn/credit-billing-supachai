import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { requireStationAccessApi } from '@/lib/api-auth';
import { closeFullShift } from '@/lib/full-shift-close';
import { listTransactionsForShiftWindow } from '@/lib/shift-transaction-utils';

const STATION_FUEL_CONFIGS: Record<string, Array<{ nozzle: number; name: string; price: number }>> = {
    'station-1': [
        { nozzle: 1, name: 'ดีเซล B7', price: 30.84 },
        { nozzle: 2, name: 'ดีเซล B7', price: 30.84 },
        { nozzle: 3, name: 'ดีเซล B7', price: 30.84 },
        { nozzle: 4, name: 'ดีเซล B7', price: 30.84 },
    ],
    'station-2': [
        ...Array.from({ length: 14 }, (_, i) => ({ nozzle: i + 1, name: 'ดีเซล B7', price: 30.84 })),
        { nozzle: 15, name: 'เบนซิน 95', price: 44.85 },
        { nozzle: 16, name: 'เบนซิน 95', price: 44.85 },
        ...Array.from({ length: 8 }, (_, i) => ({ nozzle: i + 17, name: 'E20', price: 29.54 })),
        ...Array.from({ length: 8 }, (_, i) => ({ nozzle: i + 25, name: 'แก๊สโซฮอล์ 95', price: 31.75 })),
        ...Array.from({ length: 8 }, (_, i) => ({ nozzle: i + 33, name: 'แก๊สโซฮอล์ 91', price: 31.38 })),
        { nozzle: 41, name: 'พาวเวอร์ดีเซล', price: 44.85 },
        { nozzle: 42, name: 'พาวเวอร์ดีเซล', price: 44.85 },
    ],
    'station-4': [
        ...Array.from({ length: 20 }, (_, i) => ({ nozzle: i + 1, name: 'ดีเซล', price: 30.84 })),
        ...Array.from({ length: 6 }, (_, i) => ({ nozzle: i + 21, name: 'พาวเวอร์ดีเซล', price: 44.85 })),
        ...Array.from({ length: 6 }, (_, i) => ({ nozzle: i + 27, name: 'แก๊สโซฮอล์ 95', price: 31.75 })),
        ...Array.from({ length: 4 }, (_, i) => ({ nozzle: i + 33, name: 'แก๊สโซฮอล์ 91', price: 31.38 })),
        ...Array.from({ length: 2 }, (_, i) => ({ nozzle: i + 37, name: 'เบนซิน 95', price: 44.85 })),
        ...Array.from({ length: 4 }, (_, i) => ({ nozzle: i + 39, name: 'E20', price: 29.54 })),
    ],
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        const dailyRecord = await prisma.dailyRecord.findFirst({
            where: {
                stationId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                shifts: {
                    include: {
                        staff: { select: { name: true } },
                        meters: {
                            orderBy: { nozzleNumber: 'asc' },
                        },
                    },
                    orderBy: { shiftNumber: 'asc' },
                },
            },
        });

        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: { type: true },
        });

        const products = await prisma.productInventory.findMany({
            where: { stationId },
            include: { product: true },
        });

        const fuelConfig = STATION_FUEL_CONFIGS[stationId] || STATION_FUEL_CONFIGS['station-1'];

        const lastClosedShift = await prisma.shift.findFirst({
            where: {
                dailyRecord: { stationId },
                status: { in: ['CLOSED', 'LOCKED'] },
            },
            orderBy: { closedAt: 'desc' },
            include: {
                meters: true,
            },
        });

        const carryOverReadings: Record<number, number> = {};
        if (lastClosedShift?.meters) {
            for (const meter of lastClosedShift.meters) {
                if (meter.endReading) {
                    carryOverReadings[meter.nozzleNumber] = Number(meter.endReading);
                }
            }
        }

        const activeShift =
            dailyRecord?.shifts.find((shift) => shift.status === 'OPEN') ||
            (dailyRecord?.shifts && dailyRecord.shifts.length > 0
                ? dailyRecord.shifts[dailyRecord.shifts.length - 1]
                : null);

        const transactions = activeShift
            ? await listTransactionsForShiftWindow({
                shiftId: activeShift.id,
                stationId,
                openedAt: activeShift.createdAt,
                closedAt: activeShift.closedAt,
                fallbackClosedAt: endOfDay,
            })
            : [];

        return NextResponse.json({
            date: dateStr,
            dailyRecord,
            activeShiftId: activeShift?.id || null,
            shifts: dailyRecord?.shifts.map((shift) => ({
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staffName: shift.staff?.name || null,
                createdAt: shift.createdAt,
                closedAt: shift.closedAt,
            })) || [],
            meters: dailyRecord?.shifts.flatMap((shift) =>
                shift.meters.map((meter) => ({
                    shiftId: shift.id,
                    nozzleNumber: meter.nozzleNumber,
                    startReading: meter.startReading,
                    endReading: meter.endReading,
                    soldQty: meter.soldQty,
                    startPhoto: meter.startPhoto,
                    endPhoto: meter.endPhoto,
                }))
            ) || [],
            transactions,
            products: products.map((product) => ({
                id: product.productId,
                name: product.product.name,
                price: Number(product.product.salePrice),
                quantity: product.quantity,
            })),
            fuelConfig,
            stationType: station?.type || null,
            carryOverReadings,
        });
    } catch (error) {
        console.error('[Shift End GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { shiftId, meters = [], products = [], cash = {}, anomalyNote } = body;

        if (!shiftId) {
            return NextResponse.json({ error: '❌ ไม่พบกะที่เปิดอยู่ กรุณาเปิดกะก่อน' }, { status: 400 });
        }

        const result = await closeFullShift({
            stationId,
            shiftId,
            userId: auth.user.id,
            meters,
            products,
            cash,
            anomalyNote,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Shift End POST]:', error);
        const message = error instanceof Error ? error.message : 'Failed to close shift';
        return NextResponse.json(
            { error: message },
            { status: message.startsWith('❌') ? 400 : 500 }
        );
    }
}
