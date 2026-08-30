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
import { isValidDateKey } from '@/lib/gas/date-utils';
import { resolveGasStation } from '@/lib/gas/station-resolver';
import { prisma } from '@/lib/prisma';

const gasStations = STATIONS.filter((station) => station.type === 'GAS');
const gasStationNameById = new Map<string, string>(
    gasStations.map((station) => [station.id, station.name])
);
const configuredGasStationIds = new Set<string>(
    gasStations.flatMap((station) => [
        station.id,
        ...(('aliases' in station && station.aliases) ? [...station.aliases] : []),
    ])
);

function validateAdminSupplyFilters(stationId: string | null, from: string | null, to: string | null): string | null {
    if (stationId && stationId !== 'all' && !configuredGasStationIds.has(stationId)) {
        return 'กรุณาเลือกปั๊มแก๊สให้ถูกต้อง';
    }
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

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const stationIdFilter = searchParams.get('stationId');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const filterError = validateAdminSupplyFilters(stationIdFilter, from, to);
        if (filterError) {
            return NextResponse.json({ error: filterError }, { status: 400 });
        }

        const stationIds = getGasAnalyticsStationIds(stationIdFilter);
        const { range, fromKey, toKey } = getGasSupplyDateFilter(from, to);

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

        const body = await readJsonObject(request);
        if (!body) {
            return NextResponse.json({ error: 'ข้อมูลรับแก๊สไม่ถูกต้อง' }, { status: 400 });
        }

        const stationId = typeof body.stationId === 'string' ? body.stationId.trim() : '';
        if (!configuredGasStationIds.has(stationId)) {
            return NextResponse.json({ error: 'กรุณาเลือกปั๊มแก๊สให้ถูกต้อง' }, { status: 400 });
        }
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
        const value = normalized.value;

        const supply = await prisma.$transaction(async (tx) => {
            const created = await tx.gasSupply.create({
                data: {
                    stationId: station.dbId,
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
                        stationId: station.dbId,
                        dateKey: value.dateKey,
                        liters: value.liters,
                        supplier: value.supplier,
                        invoiceNo: value.invoiceNo,
                        pricePerLiter: value.pricePerLiter,
                        totalCost: value.totalCost,
                        source: 'gas-admin-supplies',
                    },
                },
            });

            return created;
        }, { maxWait: 5_000, timeout: 20_000 });

        return NextResponse.json({
            success: true,
            supply: serializeGasSupply(supply, station.name),
        });
    } catch (error) {
        console.error('[Admin Gas Supplies POST]:', error);
        return NextResponse.json({ error: 'บันทึกรับแก๊สไม่สำเร็จ' }, { status: 500 });
    }
}
