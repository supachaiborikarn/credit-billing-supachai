import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import {
    getGasSupplyDateFilter,
    normalizeGasSupplyInput,
    serializeGasSupply,
    summarizeGasSupplies,
} from '@/lib/gas/supply-utils';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const { range } = getGasSupplyDateFilter(
            searchParams.get('from'),
            searchParams.get('to')
        );

        const rows = await prisma.gasSupply.findMany({
            where: {
                stationId: auth.station.dbId,
                date: range,
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        const supplies = rows.map((row) => serializeGasSupply(row, auth.station.name));

        return NextResponse.json({
            supplies,
            summary: summarizeGasSupplies(supplies),
        });
    } catch (error) {
        console.error('[Gas Supplies GET]:', error);
        return NextResponse.json({ error: 'โหลดข้อมูลลงแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const normalized = normalizeGasSupplyInput(body);
        if (!normalized.ok || !normalized.value) {
            return NextResponse.json({
                error: normalized.errors[0] || 'ข้อมูลรับแก๊สไม่ถูกต้อง',
                errors: normalized.errors,
            }, { status: 400 });
        }

        const supply = await prisma.gasSupply.create({
            data: {
                stationId: auth.station.dbId,
                date: normalized.value.date,
                liters: normalized.value.liters,
                supplier: normalized.value.supplier,
                invoiceNo: normalized.value.invoiceNo,
                pricePerLiter: normalized.value.pricePerLiter,
                totalCost: normalized.value.totalCost,
                notes: normalized.value.notes,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: auth.user.id,
                action: 'CREATE',
                model: 'GasSupply',
                recordId: supply.id,
                newData: {
                    stationId: auth.station.dbId,
                    dateKey: normalized.value.dateKey,
                    liters: normalized.value.liters,
                    supplier: normalized.value.supplier,
                    invoiceNo: normalized.value.invoiceNo,
                    pricePerLiter: normalized.value.pricePerLiter,
                    totalCost: normalized.value.totalCost,
                    source: 'gas-v2-supplies',
                },
            },
        });

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(supply, auth.station.name),
        });
    } catch (error) {
        console.error('[Gas Supplies POST]:', error);
        return NextResponse.json({ error: 'บันทึกรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
