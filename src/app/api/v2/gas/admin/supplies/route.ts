import { NextRequest, NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireAdminApi } from '@/lib/api-auth';
import {
    getGasAnalyticsStationIds,
} from '@/lib/gas/admin-analytics';
import {
    getGasSupplyDateFilter,
    normalizeGasSupplyInput,
    serializeGasSupply,
    summarizeGasSupplies,
} from '@/lib/gas/supply-utils';
import {
    buildStationStockForecast,
    buildSupplyGaugeChecks,
} from '@/lib/gas/stock-utils';
import { resolveGasStation } from '@/lib/gas/station-resolver';
import { prisma } from '@/lib/prisma';

const gasStationNameById = new Map<string, string>(
    STATIONS
        .filter((station) => station.type === 'GAS')
        .map((station) => [station.id, station.name])
);

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationIdFilter = searchParams.get('stationId');
        const stationIds = getGasAnalyticsStationIds(stationIdFilter);
        const { range, fromKey, toKey } = getGasSupplyDateFilter(
            searchParams.get('from'),
            searchParams.get('to')
        );

        const rows = await prisma.gasSupply.findMany({
            where: {
                stationId: { in: stationIds },
                date: range,
            },
            include: {
                station: { select: { name: true } },
            },
            orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        const supplies = rows.map((row) => serializeGasSupply(
            row,
            gasStationNameById.get(row.stationId) ?? row.station?.name ?? row.stationId
        ));
        const stationSummary = STATIONS
            .filter((station) => station.type === 'GAS')
            .map((station) => {
                const stationRows = supplies.filter((supply) => supply.stationId === station.id);
                return {
                    stationId: station.id,
                    stationName: station.name,
                    ...summarizeGasSupplies(stationRows),
                };
            });

        // ตรวจเทียบใบส่งกับเดลต้าเกจ + คาดการณ์สต็อกของแต่ละปั๊ม
        const [gaugeChecks, stockForecasts] = await Promise.all([
            buildSupplyGaugeChecks(supplies.map((supply) => ({
                stationId: supply.stationId,
                date: supply.date,
                liters: supply.liters,
            }))),
            Promise.all(
                Array.from(gasStationNameById.keys()).map(async (gasStationId) => ({
                    stationName: gasStationNameById.get(gasStationId) ?? gasStationId,
                    ...(await buildStationStockForecast(gasStationId)),
                }))
            ),
        ]);

        const suppliesWithGaugeCheck = supplies.map((supply) => ({
            ...supply,
            gaugeCheck: gaugeChecks.get(
                `${supply.stationId}:${supply.date.split('T')[0]}`
            ) ?? null,
        }));

        return NextResponse.json({
            from: fromKey,
            to: toKey,
            supplies: suppliesWithGaugeCheck,
            summary: summarizeGasSupplies(supplies),
            stationSummary,
            stockForecasts,
        });
    } catch (error) {
        console.error('[Admin Gas Supplies GET]:', error);
        return NextResponse.json({ error: 'โหลดข้อมูลลงแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const stationId = typeof body.stationId === 'string' ? body.stationId : '';
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json({ error: 'กรุณาเลือกปั๊มแก๊สให้ถูกต้อง' }, { status: 400 });
        }

        const normalized = normalizeGasSupplyInput(body);
        if (!normalized.ok || !normalized.value) {
            return NextResponse.json({
                error: normalized.errors[0] || 'ข้อมูลรับแก๊สไม่ถูกต้อง',
                errors: normalized.errors,
            }, { status: 400 });
        }

        const supply = await prisma.gasSupply.create({
            data: {
                stationId: station.dbId,
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
                    stationId: station.dbId,
                    dateKey: normalized.value.dateKey,
                    liters: normalized.value.liters,
                    supplier: normalized.value.supplier,
                    invoiceNo: normalized.value.invoiceNo,
                    pricePerLiter: normalized.value.pricePerLiter,
                    totalCost: normalized.value.totalCost,
                    source: 'gas-admin-supplies',
                },
            },
        });

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(supply, station.name),
        });
    } catch (error) {
        console.error('[Admin Gas Supplies POST]:', error);
        return NextResponse.json({ error: 'บันทึกรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
