import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    normalizeGasSupplyInput,
    serializeGasSupply,
} from '@/lib/gas/supply-utils';
import { toBangkokDateKey } from '@/lib/gas/date-utils';
import { resolveGasStation } from '@/lib/gas/station-resolver';
import { prisma } from '@/lib/prisma';

const gasStations = STATIONS.filter((station) => station.type === 'GAS');
const configuredGasStationIds = new Set<string>(
    gasStations.flatMap((station) => [
        station.id,
        ...(('aliases' in station && station.aliases) ? [...station.aliases] : []),
    ])
);

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
}

function supplyAuditSnapshot(supply: {
    stationId: string;
    date: Date;
    liters: unknown;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: unknown;
    totalCost: unknown;
    notes: string | null;
}) {
    return {
        stationId: supply.stationId,
        dateKey: toBangkokDateKey(supply.date),
        liters: Number(supply.liters),
        supplier: supply.supplier,
        invoiceNo: supply.invoiceNo,
        pricePerLiter: supply.pricePerLiter !== null ? Number(supply.pricePerLiter) : null,
        totalCost: supply.totalCost !== null ? Number(supply.totalCost) : null,
        notes: supply.notes,
    };
}

/**
 * PUT /api/v2/gas/admin/supplies/[supplyId]
 * แก้ไขรายการรับแก๊สเข้าถัง (admin เท่านั้น พร้อม audit log old/new)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ supplyId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { supplyId } = await params;
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

        const requestedStationId = typeof body.stationId === 'string' ? body.stationId.trim() : null;
        if (requestedStationId && !configuredGasStationIds.has(requestedStationId)) {
            return NextResponse.json({ error: 'กรุณาเลือกปั๊มแก๊สให้ถูกต้อง' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.gasSupply.findUnique({ where: { id: supplyId } });
            if (!existing) return { status: 'NOT_FOUND' as const };
            if (!configuredGasStationIds.has(existing.stationId)) return { status: 'INVALID_STATION' as const };

            const existingStation = await resolveGasStation(existing.stationId);
            if (!existingStation) return { status: 'INVALID_STATION' as const };
            if (requestedStationId) {
                const requestedStation = await resolveGasStation(requestedStationId);
                if (!requestedStation || requestedStation.dbId !== existingStation.dbId) {
                    return { status: 'STATION_MISMATCH' as const };
                }
            }

            const updated = await tx.gasSupply.update({
                where: { id: supplyId },
                data: {
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
                    action: 'UPDATE',
                    model: 'GasSupply',
                    recordId: supplyId,
                    oldData: supplyAuditSnapshot(existing),
                    newData: {
                        ...supplyAuditSnapshot(updated),
                        source: 'gas-admin-supplies',
                    },
                },
            });

            return { status: 'OK' as const, updated, stationName: existingStation.name };
        }, { maxWait: 5_000, timeout: 20_000 });

        if (result.status === 'NOT_FOUND') {
            return NextResponse.json({ error: 'ไม่พบรายการรับแก๊สนี้' }, { status: 404 });
        }
        if (result.status === 'INVALID_STATION') {
            return NextResponse.json({ error: 'รายการรับแก๊สนี้ไม่ได้ผูกกับปั๊ม GAS ที่รองรับ' }, { status: 409 });
        }
        if (result.status === 'STATION_MISMATCH') {
            return NextResponse.json({ error: 'ไม่อนุญาตให้ย้ายรายการรับแก๊สข้ามปั๊มระหว่างแก้ไข' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(result.updated, result.stationName),
        });
    } catch (error) {
        console.error('[Admin Gas Supplies PUT]:', error);
        return NextResponse.json({ error: 'แก้ไขรายการรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}

/**
 * DELETE /api/v2/gas/admin/supplies/[supplyId]
 * ลบรายการรับแก๊ส (admin เท่านั้น เก็บข้อมูลเดิมไว้ใน audit log)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ supplyId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { supplyId } = await params;
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.gasSupply.findUnique({ where: { id: supplyId } });
            if (!existing) return { status: 'NOT_FOUND' as const };
            if (!configuredGasStationIds.has(existing.stationId)) return { status: 'INVALID_STATION' as const };

            const station = await resolveGasStation(existing.stationId);
            if (!station) return { status: 'INVALID_STATION' as const };

            await tx.gasSupply.delete({ where: { id: supplyId } });
            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'DELETE',
                    model: 'GasSupply',
                    recordId: supplyId,
                    oldData: {
                        ...supplyAuditSnapshot(existing),
                        source: 'gas-admin-supplies',
                    },
                },
            });

            return { status: 'OK' as const };
        }, { maxWait: 5_000, timeout: 20_000 });

        if (result.status === 'NOT_FOUND') {
            return NextResponse.json({ error: 'ไม่พบรายการรับแก๊สนี้' }, { status: 404 });
        }
        if (result.status === 'INVALID_STATION') {
            return NextResponse.json({ error: 'รายการรับแก๊สนี้ไม่ได้ผูกกับปั๊ม GAS ที่รองรับ' }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Admin Gas Supplies DELETE]:', error);
        return NextResponse.json({ error: 'ลบรายการรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
