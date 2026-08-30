import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasStationAccess } from '@/lib/gas/api-guards';
import { isValidDateKey } from '@/lib/gas/date-utils';
import {
    getGasSupplyDateFilter,
    normalizeGasSupplyInput,
    serializeGasSupply,
    summarizeGasSupplies,
} from '@/lib/gas/supply-utils';

function validateSupplyDateFilters(from: string | null, to: string | null): string | null {
    if (from && !isValidDateKey(from)) return 'วันที่เริ่มต้นไม่ถูกต้อง';
    if (to && !isValidDateKey(to)) return 'วันที่สิ้นสุดไม่ถูกต้อง';
    if (from && to && from > to) return 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด';
    return null;
}

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;
        const auth = await requireGasStationAccess(stationId);
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const filterError = validateSupplyDateFilters(from, to);
        if (filterError) {
            return NextResponse.json({ error: filterError }, { status: 400 });
        }
        const { range } = getGasSupplyDateFilter(from, to);

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

        const body = await readJsonObject(request);
        if (!body) {
            return NextResponse.json({ error: 'ข้อมูลรับแก๊สไม่ถูกต้อง' }, { status: 400 });
        }
        const normalized = normalizeGasSupplyInput(body);
        if (!normalized.ok || !normalized.value) {
            return NextResponse.json({
                error: normalized.errors[0] || 'ข้อมูลรับแก๊สไม่ถูกต้อง',
                errors: normalized.errors,
            }, { status: 400 });
        }
        const value = normalized.value;

        const supply = await prisma.$transaction(async (tx) => {
            const created = await tx.gasSupply.create({
            data: {
                stationId: auth.station.dbId,
                    date: value.date,
                    liters: value.liters,
                    supplier: value.supplier,
                    invoiceNo: value.invoiceNo,
                    pricePerLiter: value.pricePerLiter,
                    totalCost: value.totalCost,
                    notes: value.notes,
                },
            });

            await tx.auditLog.create({
                data: {
                userId: auth.user.id,
                action: 'CREATE',
                model: 'GasSupply',
                    recordId: created.id,
                    newData: {
                        stationId: auth.station.dbId,
                        dateKey: value.dateKey,
                        liters: value.liters,
                        supplier: value.supplier,
                        invoiceNo: value.invoiceNo,
                        pricePerLiter: value.pricePerLiter,
                        totalCost: value.totalCost,
                        source: 'gas-v2-supplies',
                    },
                },
            });

            return created;
        }, { maxWait: 5_000, timeout: 20_000 });

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(supply, auth.station.name),
        });
    } catch (error) {
        console.error('[Gas Supplies POST]:', error);
        return NextResponse.json({ error: 'บันทึกรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
