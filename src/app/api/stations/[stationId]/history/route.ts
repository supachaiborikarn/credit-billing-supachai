import { NextResponse } from 'next/server';
import { ShiftStatus } from '@prisma/client';
import { requireApiSession } from '@/lib/api-auth';
import { formatDateBangkok, getEndOfDayBangkok, getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import {
    buildStationPermissions,
    resolveStationDefinition,
} from '@/lib/stations/station-context';
import {
    buildShiftGaugeHistory,
    getHistoryAttentionReasons,
    getStationHistoryRange,
    normalizeHistoryVariance,
} from '@/lib/stations/station-history';
import type {
    StationHistoryDailyAnomaly,
    StationHistoryResponse,
    StationHistoryShift,
    StationHistoryStatus,
} from '@/types/station-history';

const VALID_STATUSES = new Set(['ALL', 'OPEN', 'CLOSED', 'LOCKED']);

function toNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { stationId } = await params;
        const station = resolveStationDefinition(stationId);
        if (!station) {
            return NextResponse.json({ error: 'ไม่พบสถานี' }, { status: 404 });
        }

        const permissions = buildStationPermissions(auth.user, station);
        if (!permissions.canViewHistory) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดูประวัติสถานีนี้' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        let range;
        try {
            range = getStationHistoryRange({
                from: searchParams.get('from'),
                to: searchParams.get('to'),
                today: getTodayBangkok(),
            });
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'ช่วงวันที่ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const rawStatus = (searchParams.get('status') || 'ALL').toUpperCase();
        if (!VALID_STATUSES.has(rawStatus)) {
            return NextResponse.json({ error: 'สถานะกะไม่ถูกต้อง' }, { status: 400 });
        }
        const status = rawStatus as 'ALL' | StationHistoryStatus;
        const attentionOnly = searchParams.get('attention') === '1';
        const startDate = getStartOfDayBangkok(range.from);
        const endDate = getEndOfDayBangkok(range.to);

        const [shifts, dailyAnomalies] = await Promise.all([
            prisma.shift.findMany({
                where: {
                    dailyRecord: {
                        stationId: station.id,
                        date: { gte: startDate, lte: endDate },
                    },
                    ...(status !== 'ALL' ? { status: status as ShiftStatus } : {}),
                },
                include: {
                    dailyRecord: {
                        select: {
                            date: true,
                            gasPrice: true,
                            gaugeReadings: {
                                select: {
                                    tankNumber: true,
                                    percentage: true,
                                    photoUrl: true,
                                    shiftNumber: true,
                                    notes: true,
                                    createdAt: true,
                                },
                            },
                        },
                    },
                    staff: { select: { name: true } },
                    closedBy: { select: { name: true } },
                    meters: {
                        orderBy: { nozzleNumber: 'asc' },
                        select: {
                            nozzleNumber: true,
                            startReading: true,
                            endReading: true,
                            soldQty: true,
                            startPhoto: true,
                            endPhoto: true,
                        },
                    },
                    transactions: {
                        where: { deletedAt: null, isVoided: false },
                        select: { liters: true, amount: true },
                    },
                    anomalies: {
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            nozzleNumber: true,
                            soldQty: true,
                            averageQty: true,
                            percentDiff: true,
                            severity: true,
                            note: true,
                            reviewedAt: true,
                            createdAt: true,
                        },
                    },
                    reconciliation: true,
                },
                orderBy: [
                    { dailyRecord: { date: 'desc' } },
                    { shiftNumber: 'desc' },
                    { createdAt: 'desc' },
                ],
                take: 250,
            }),
            prisma.dailyAnomaly.findMany({
                where: {
                    stationId: station.id,
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'desc' },
                select: {
                    id: true,
                    date: true,
                    meterTotal: true,
                    transTotal: true,
                    difference: true,
                    severity: true,
                    note: true,
                    reviewedAt: true,
                },
            }),
        ]);

        const dailyAnomalyByDate = new Map<string, StationHistoryDailyAnomaly>();
        for (const anomaly of dailyAnomalies) {
            const date = formatDateBangkok(anomaly.date);
            dailyAnomalyByDate.set(date, {
                id: anomaly.id,
                date,
                meterTotal: toNumber(anomaly.meterTotal),
                transactionTotal: toNumber(anomaly.transTotal),
                difference: toNumber(anomaly.difference),
                severity: anomaly.severity,
                note: anomaly.note,
                reviewedAt: anomaly.reviewedAt?.toISOString() || null,
            });
        }

        const normalized: StationHistoryShift[] = shifts.map((shift) => {
            const businessDate = formatDateBangkok(shift.dailyRecord.date);
            const dailyAnomaly = dailyAnomalyByDate.get(businessDate) || null;
            const meters = shift.meters.map((meter) => {
                const startReading = toNumber(meter.startReading);
                const endReading = meter.endReading == null ? null : toNumber(meter.endReading);
                const soldQty = meter.soldQty == null
                    ? (endReading == null ? null : Math.max(0, endReading - startReading))
                    : toNumber(meter.soldQty);
                return {
                    nozzleNumber: meter.nozzleNumber,
                    startReading,
                    endReading,
                    soldQty,
                    startPhoto: meter.startPhoto,
                    endPhoto: meter.endPhoto,
                };
            });
            const gauges = station.type === 'GAS'
                ? buildShiftGaugeHistory(shift.dailyRecord.gaugeReadings, shift.shiftNumber)
                : [];
            const anomalies = shift.anomalies.map((anomaly) => ({
                id: anomaly.id,
                nozzleNumber: anomaly.nozzleNumber,
                soldQty: toNumber(anomaly.soldQty),
                averageQty: toNumber(anomaly.averageQty),
                percentDiff: toNumber(anomaly.percentDiff),
                severity: anomaly.severity,
                note: anomaly.note,
                reviewedAt: anomaly.reviewedAt?.toISOString() || null,
                createdAt: anomaly.createdAt.toISOString(),
            }));
            const reconciliation = shift.reconciliation
                ? {
                    expectedFuelAmount: toNumber(shift.reconciliation.expectedFuelAmount),
                    expectedOtherAmount: toNumber(shift.reconciliation.expectedOtherAmount),
                    totalExpected: toNumber(shift.reconciliation.totalExpected),
                    totalReceived: toNumber(shift.reconciliation.totalReceived),
                    cashReceived: toNumber(shift.reconciliation.cashReceived),
                    creditReceived: toNumber(shift.reconciliation.creditReceived),
                    transferReceived: toNumber(shift.reconciliation.transferReceived),
                    productSalesAmount: toNumber(shift.reconciliation.productSalesAmount),
                    productTransferAmount: toNumber(shift.reconciliation.productTransferAmount),
                    otherIncomeAmount: toNumber(shift.reconciliation.otherIncomeAmount),
                    otherIncomeNote: shift.reconciliation.otherIncomeNote,
                    otherExpensesAmount: toNumber(shift.reconciliation.otherExpensesAmount),
                    otherExpenseNote: shift.reconciliation.otherExpenseNote,
                    // Normalize historical FULL/GAS sign conventions to: received - expected.
                    variance: normalizeHistoryVariance(shift.reconciliation.totalExpected, shift.reconciliation.totalReceived),
                    varianceStatus: shift.reconciliation.varianceStatus,
                }
                : null;
            const attentionReasons = getHistoryAttentionReasons({
                status: shift.status,
                anomalyCount: anomalies.length,
                dailyAnomaly: Boolean(dailyAnomaly),
                varianceStatus: reconciliation?.varianceStatus,
            });

            return {
                id: shift.id,
                businessDate,
                shiftNumber: shift.shiftNumber,
                status: shift.status as StationHistoryStatus,
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                staffName: shift.staff?.name || null,
                closedByName: shift.closedBy?.name || null,
                varianceNote: shift.varianceNote,
                gasPrice: shift.dailyRecord.gasPrice == null ? null : toNumber(shift.dailyRecord.gasPrice),
                meters,
                gauges,
                totalMeterLiters: Number(meters.reduce((sum, meter) => sum + (meter.soldQty || 0), 0).toFixed(3)),
                transactionCount: shift.transactions.length,
                transactionLiters: Number(shift.transactions.reduce((sum, transaction) => sum + toNumber(transaction.liters), 0).toFixed(3)),
                transactionAmount: Number(shift.transactions.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0).toFixed(2)),
                anomalies,
                dailyAnomaly,
                reconciliation,
                attentionReasons,
            };
        });

        const visibleShifts = attentionOnly
            ? normalized.filter((shift) => shift.attentionReasons.length > 0)
            : normalized;
        const uniqueDailyAnomalies = new Set(
            visibleShifts.map((shift) => shift.dailyAnomaly?.id).filter(Boolean)
        );

        const response: StationHistoryResponse = {
            station: {
                id: station.id,
                name: station.name,
                type: station.type,
                operationalStatus: station.operationalStatus,
            },
            filters: { from: range.from, to: range.to, status, attentionOnly },
            summary: {
                shifts: visibleShifts.length,
                openShifts: visibleShifts.filter((shift) => shift.status === 'OPEN').length,
                attentionShifts: visibleShifts.filter((shift) => shift.attentionReasons.length > 0).length,
                meterAnomalies: visibleShifts.reduce((sum, shift) => sum + shift.anomalies.length, 0),
                dailyAnomalies: uniqueDailyAnomalies.size,
            },
            shifts: visibleShifts,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[Station History GET]:', error);
        return NextResponse.json({ error: 'โหลดประวัติสถานีไม่สำเร็จ' }, { status: 500 });
    }
}
