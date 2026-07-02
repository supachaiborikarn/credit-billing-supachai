import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    normalizeGasSupplyInput,
    serializeGasSupply,
} from '@/lib/gas/supply-utils';
import { toBangkokDateKey } from '@/lib/gas/date-utils';
import { prisma } from '@/lib/prisma';

const gasStationNameById = new Map<string, string>(
    STATIONS
        .filter((station) => station.type === 'GAS')
        .map((station) => [station.id, station.name])
);

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
        const existing = await prisma.gasSupply.findUnique({ where: { id: supplyId } });
        if (!existing) {
            return NextResponse.json({ error: 'ไม่พบรายการรับแก๊สนี้' }, { status: 404 });
        }

        const body = await request.json();
        const normalized = normalizeGasSupplyInput(body);
        if (!normalized.ok || !normalized.value) {
            return NextResponse.json({
                error: normalized.errors[0] || 'ข้อมูลรับแก๊สไม่ถูกต้อง',
                errors: normalized.errors,
            }, { status: 400 });
        }

        const updated = await prisma.gasSupply.update({
            where: { id: supplyId },
            data: {
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

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(
                updated,
                gasStationNameById.get(updated.stationId) ?? updated.stationId
            ),
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
        const existing = await prisma.gasSupply.findUnique({ where: { id: supplyId } });
        if (!existing) {
            return NextResponse.json({ error: 'ไม่พบรายการรับแก๊สนี้' }, { status: 404 });
        }

        await prisma.gasSupply.delete({ where: { id: supplyId } });

        await prisma.auditLog.create({
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Admin Gas Supplies DELETE]:', error);
        return NextResponse.json({ error: 'ลบรายการรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
