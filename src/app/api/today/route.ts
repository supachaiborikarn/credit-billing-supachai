import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/api-auth';
import { CREDIT_PAYMENT_TYPES } from '@/constants/payment-types';
import { STATIONS, STATION_STAFF, findStationIndex } from '@/constants';
import {
    getEndOfDayBangkok,
    getStartOfDayBangkok,
    getTodayBangkok,
} from '@/lib/date-utils';
import {
    getEndOfDayBangkokUTC,
    getGasActiveShiftDateRange,
    getGasBusinessDateKey,
    getStartOfDayBangkokUTC,
    toBangkokDateKey,
} from '@/lib/gas';
import { selectCanonicalFullStationShift } from '@/lib/full-station-shift-scope';
import { withPrismaReadRetry } from '@/lib/prisma-read-retry';
import type {
    TodayAdminPayload,
    TodayBillingAttention,
    TodayPrimaryAction,
    TodayStaffPayload,
    TodayStationSnapshot,
    TodayStationState,
    TodaySummary,
    TodayTransaction,
    TodayUser,
    TodayWorkItem,
} from '@/types/today';

const ACTIVE_STATION_IDS = ['station-1', 'station-5', 'station-6'] as const;
const RETIRED_STATION_IDS = ['station-2', 'station-3', 'station-4'] as const;

const stateLabels: Record<TodayStationState, string> = {
    NO_SHIFT: 'ยังไม่เปิดกะ',
    SHIFT_OPEN: 'กำลังทำงาน',
    SHIFT_NEEDS_ATTENTION: 'มีรายการต้องตรวจ',
    READY_TO_CLOSE: 'พร้อมปิดกะ',
    STALE_SHIFT: 'มีกะค้าง',
    CLOSED: 'งานวันนี้ปิดแล้ว',
    RETIRED: 'ย้ายไป POS แล้ว',
};

type StationConfig = (typeof STATIONS)[number];
type ActiveStationConfig = Extract<StationConfig, { type: 'FULL' | 'GAS' }>;

type TransactionRow = {
    id: string;
    stationId: string;
    date: Date;
    licensePlate: string | null;
    ownerId: string | null;
    ownerName: string | null;
    paymentType: string;
    liters: unknown;
    amount: unknown;
    transferProofUrl: string | null;
    shiftId: string | null;
};

function resolveStationConfig(stationId: string | null): StationConfig | null {
    if (!stationId) return null;
    const stationNumber = findStationIndex(stationId);
    return stationNumber > 0 ? STATIONS[stationNumber - 1] : null;
}

function getStationNumber(stationId: string): number {
    return findStationIndex(stationId);
}

function getStationPaths(station: ActiveStationConfig) {
    const stationNumber = getStationNumber(station.id);

    if (station.type === 'GAS') {
        const base = `/gas/${stationNumber}`;
        return {
            base,
            open: `${base}/shift/open`,
            sell: `${base}/sell`,
            attention: base,
            close: `${base}/shift/close`,
            summary: `/stations/${station.id}`,
        };
    }

    const base = `/station/${stationNumber}/v2`;
    return {
        base,
        open: base,
        sell: base,
        attention: base,
        close: base,
        summary: base,
    };
}

function getPrimaryAction(
    state: Exclude<TodayStationState, 'RETIRED'>,
    station: ActiveStationConfig
): TodayPrimaryAction {
    const paths = getStationPaths(station);

    switch (state) {
        case 'NO_SHIFT':
            return { label: 'เปิดกะ', href: paths.open };
        case 'SHIFT_OPEN':
            return { label: 'ขายใหม่', href: paths.sell };
        case 'SHIFT_NEEDS_ATTENTION':
            return { label: 'แก้รายการที่ต้องตรวจ', href: paths.attention };
        case 'READY_TO_CLOSE':
            return { label: 'ปิดกะ', href: paths.close };
        case 'STALE_SHIFT':
            return { label: 'จัดการกะค้าง', href: paths.attention };
        case 'CLOSED':
            return { label: 'ดูสรุปวันนี้', href: paths.summary };
    }
}

function toTodayTransaction(row: TransactionRow, station: StationConfig): TodayTransaction {
    return {
        id: row.id,
        stationId: station.id,
        stationName: station.name,
        date: row.date.toISOString(),
        licensePlate: row.licensePlate,
        ownerName: row.ownerName,
        paymentType: row.paymentType,
        liters: Number(row.liters),
        amount: Number(row.amount),
    };
}

function summarizeTransactions(rows: TransactionRow[]): TodaySummary {
    return rows.reduce<TodaySummary>(
        (summary, row) => ({
            transactionCount: summary.transactionCount + 1,
            liters: summary.liters + Number(row.liters),
            amount: summary.amount + Number(row.amount),
        }),
        { transactionCount: 0, liters: 0, amount: 0 }
    );
}

function transactionWorkItems(
    rows: TransactionRow[],
    station: ActiveStationConfig,
    checkUnlinkedShift: boolean
): TodayWorkItem[] {
    const paths = getStationPaths(station);
    const items: TodayWorkItem[] = [];

    for (const row of rows) {
        if (row.paymentType === 'TRANSFER' && !row.transferProofUrl) {
            items.push({
                id: `transfer-proof:${row.id}`,
                type: 'MISSING_TRANSFER_PROOF',
                severity: 'warning',
                title: 'รายการโอนยังไม่มีสลิป',
                detail: row.licensePlate || row.ownerName || `รายการ ${row.id.slice(0, 8)}`,
                href: paths.attention,
                stationId: station.id,
                stationName: station.name,
            });
        }

        const isCredit = CREDIT_PAYMENT_TYPES.some((type) => type === row.paymentType);
        if (isCredit && !row.ownerId && !row.ownerName) {
            items.push({
                id: `credit-owner:${row.id}`,
                type: 'INCOMPLETE_CREDIT',
                severity: 'critical',
                title: 'รายการเงินเชื่อยังไม่ผูกลูกค้า',
                detail: row.licensePlate || `รายการ ${row.id.slice(0, 8)}`,
                href: paths.attention,
                stationId: station.id,
                stationName: station.name,
            });
        }

        if (checkUnlinkedShift && row.paymentType !== 'EXPENSE' && !row.shiftId) {
            items.push({
                id: `unlinked-shift:${row.id}`,
                type: 'UNLINKED_TRANSACTION',
                severity: 'critical',
                title: 'รายการขายไม่ได้ผูกกับกะ',
                detail: row.licensePlate || row.ownerName || `รายการ ${row.id.slice(0, 8)}`,
                href: paths.attention,
                stationId: station.id,
                stationName: station.name,
            });
        }
    }

    return items;
}

function hasAttention(items: TodayWorkItem[]): boolean {
    return items.some((item) => item.severity === 'warning' || item.severity === 'critical');
}

function severityRank(severity: TodayWorkItem['severity']): number {
    if (severity === 'critical') return 0;
    if (severity === 'warning') return 1;
    return 2;
}

function dedupeAndSortWorkItems(items: TodayWorkItem[], limit = 30): TodayWorkItem[] {
    const unique = new Map<string, TodayWorkItem>();
    for (const item of items) {
        if (!unique.has(item.id)) unique.set(item.id, item);
    }

    return [...unique.values()]
        .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
        .slice(0, limit);
}

async function buildFullStationSnapshot(station: ActiveStationConfig & { type: 'FULL' }): Promise<TodayStationSnapshot> {
    const dateKey = getTodayBangkok();
    const start = getStartOfDayBangkok(dateKey);
    const end = getEndOfDayBangkok(dateKey);
    const paths = getStationPaths(station);

    const [dailyRecord, staleShift, transactions] = await Promise.all([
        prisma.dailyRecord.findFirst({
            where: { stationId: station.id, date: { gte: start, lte: end } },
            include: {
                shifts: {
                    orderBy: [{ shiftNumber: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        meters: true,
                        anomalies: { where: { reviewedAt: null } },
                        reconciliation: true,
                        staff: { select: { name: true } },
                        _count: { select: { transactions: true } },
                    },
                },
            },
        }),
        prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: { stationId: station.id, date: { lt: start } },
            },
            include: { dailyRecord: { select: { date: true } } },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.transaction.findMany({
            where: {
                stationId: station.id,
                date: { gte: start, lte: end },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                id: true,
                stationId: true,
                date: true,
                licensePlate: true,
                ownerId: true,
                ownerName: true,
                paymentType: true,
                liters: true,
                amount: true,
                transferProofUrl: true,
                shiftId: true,
            },
            orderBy: { date: 'desc' },
        }),
    ]);

    const canonicalShift = dailyRecord ? selectCanonicalFullStationShift(dailyRecord.shifts) : null;
    const openShift = canonicalShift?.status === 'OPEN' ? canonicalShift : null;
    const latestShift = canonicalShift;
    const workItems: TodayWorkItem[] = [];

    if (staleShift) {
        workItems.push({
            id: `stale-shift:${staleShift.id}`,
            type: 'STALE_SHIFT',
            severity: 'critical',
            title: 'มีกะค้างจากวันก่อน',
            detail: `กะ ${staleShift.shiftNumber} วันที่ ${staleShift.dailyRecord.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    if (openShift && openShift.meters.length < 4) {
        workItems.push({
            id: `opening-data:${openShift.id}`,
            type: 'MISSING_OPENING_DATA',
            severity: 'warning',
            title: 'ข้อมูลมิเตอร์เปิดกะยังไม่ครบ',
            detail: `มี ${openShift.meters.length}/4 หัว`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    if (openShift) {
        const endMeterCount = openShift.meters.filter((meter) => meter.endReading !== null).length;
        if (endMeterCount > 0 && endMeterCount < 4) {
            workItems.push({
                id: `closing-data:${openShift.id}`,
                type: 'MISSING_CLOSING_DATA',
                severity: 'warning',
                title: 'บันทึกมิเตอร์ปิดกะยังไม่ครบ',
                detail: `ครบ ${endMeterCount}/4 หัว`,
                href: paths.attention,
                stationId: station.id,
                stationName: station.name,
            });
        }
    }

    for (const anomaly of latestShift?.anomalies || []) {
        workItems.push({
            id: `meter-anomaly:${anomaly.id}`,
            type: 'METER_ANOMALY',
            severity: anomaly.severity === 'CRITICAL' ? 'critical' : 'warning',
            title: `มิเตอร์หัว ${anomaly.nozzleNumber} ผิดปกติ`,
            detail: `ต่างจากค่าเฉลี่ย ${Number(anomaly.percentDiff).toFixed(1)}%`,
            href: '/admin/anomalies',
            stationId: station.id,
            stationName: station.name,
        });
    }

    if (latestShift?.reconciliation && latestShift.reconciliation.varianceStatus !== 'GREEN') {
        workItems.push({
            id: `variance:${latestShift.reconciliation.id}`,
            type: 'RECONCILIATION_VARIANCE',
            severity: latestShift.reconciliation.varianceStatus === 'RED' ? 'critical' : 'warning',
            title: 'ยอดกระทบกะมีผลต่าง',
            detail: `${Number(latestShift.reconciliation.variance).toFixed(2)} บาท`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    workItems.push(...transactionWorkItems(transactions, station, false));

    const endMetersComplete = Boolean(
        openShift &&
        openShift.meters.length >= 4 &&
        openShift.meters.every((meter) => meter.endReading !== null)
    );

    let state: Exclude<TodayStationState, 'RETIRED'>;
    if (staleShift) {
        state = 'STALE_SHIFT';
    } else if (openShift) {
        state = hasAttention(workItems)
            ? 'SHIFT_NEEDS_ATTENTION'
            : endMetersComplete
                ? 'READY_TO_CLOSE'
                : 'SHIFT_OPEN';
    } else if (latestShift) {
        state = 'CLOSED';
    } else {
        state = 'NO_SHIFT';
    }

    const shift = latestShift
        ? {
            id: latestShift.id,
            shiftNumber: latestShift.shiftNumber,
            status: latestShift.status,
            staffName: latestShift.staff?.name || null,
            openedAt: latestShift.createdAt.toISOString(),
            closedAt: latestShift.closedAt?.toISOString() || null,
            businessDate: dateKey,
        }
        : null;

    return {
        stationId: station.id,
        stationName: station.name,
        stationType: 'FULL',
        stationNumber: getStationNumber(station.id),
        state,
        stateLabel: stateLabels[state],
        shift,
        primaryAction: getPrimaryAction(state, station),
        workItems: dedupeAndSortWorkItems(workItems),
        summary: summarizeTransactions(transactions),
        recentTransactions: transactions.slice(0, 5).map((row) => toTodayTransaction(row, station)),
        href: paths.base,
    };
}

async function buildGasStationSnapshot(station: ActiveStationConfig & { type: 'GAS' }): Promise<TodayStationSnapshot> {
    const dateKey = getGasBusinessDateKey();
    const businessStart = getStartOfDayBangkokUTC(dateKey);
    const businessEnd = getEndOfDayBangkokUTC(dateKey);
    const activeRange = getGasActiveShiftDateRange(dateKey);
    const paths = getStationPaths(station);
    const shiftInclude = {
        dailyRecord: true,
        staff: { select: { name: true } },
        meters: { orderBy: { nozzleNumber: 'asc' as const } },
        anomalies: { where: { reviewedAt: null } },
        reconciliation: true,
    };

    const [openShift, latestCurrentShift, staleShift, currentShiftCount] = await Promise.all([
        prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: {
                    stationId: station.id,
                    date: { gte: activeRange.start, lte: activeRange.end },
                },
            },
            orderBy: [{ dailyRecord: { date: 'desc' } }, { createdAt: 'desc' }],
            include: shiftInclude,
        }),
        prisma.shift.findFirst({
            where: {
                dailyRecord: {
                    stationId: station.id,
                    date: { gte: businessStart, lte: businessEnd },
                },
            },
            orderBy: [{ shiftNumber: 'desc' }, { createdAt: 'desc' }],
            include: shiftInclude,
        }),
        prisma.shift.findFirst({
            where: {
                status: 'OPEN',
                dailyRecord: { stationId: station.id, date: { lt: businessStart } },
            },
            include: { dailyRecord: { select: { date: true } } },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.shift.count({
            where: {
                dailyRecord: {
                    stationId: station.id,
                    date: { gte: businessStart, lte: businessEnd },
                },
            },
        }),
    ]);

    const shift = openShift || latestCurrentShift;
    const transactionWhere = shift
        ? { shiftId: shift.id, deletedAt: null, isVoided: false }
        : {
            stationId: station.id,
            date: { gte: businessStart, lte: businessEnd },
            deletedAt: null,
            isVoided: false,
        };

    const [gaugeReadings, transactions, unlinkedTransactions] = await Promise.all([
        shift
            ? prisma.gaugeReading.findMany({
                where: {
                    stationId: station.id,
                    dailyRecordId: shift.dailyRecordId,
                    shiftNumber: shift.shiftNumber,
                },
                select: { tankNumber: true, notes: true },
            })
            : Promise.resolve([]),
        prisma.transaction.findMany({
            where: transactionWhere,
            select: {
                id: true,
                stationId: true,
                date: true,
                licensePlate: true,
                ownerId: true,
                ownerName: true,
                paymentType: true,
                liters: true,
                amount: true,
                transferProofUrl: true,
                shiftId: true,
            },
            orderBy: { date: 'desc' },
        }),
        prisma.transaction.findMany({
            where: {
                stationId: station.id,
                shiftId: null,
                paymentType: { not: 'EXPENSE' },
                date: { gte: activeRange.start, lte: activeRange.end },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                id: true,
                stationId: true,
                date: true,
                licensePlate: true,
                ownerId: true,
                ownerName: true,
                paymentType: true,
                liters: true,
                amount: true,
                transferProofUrl: true,
                shiftId: true,
            },
            orderBy: { date: 'desc' },
            take: 20,
        }),
    ]);

    const workItems: TodayWorkItem[] = [];

    if (staleShift && staleShift.id !== openShift?.id) {
        workItems.push({
            id: `stale-shift:${staleShift.id}`,
            type: 'STALE_SHIFT',
            severity: 'critical',
            title: 'มีกะค้างจากวันก่อน',
            detail: `กะ ${staleShift.shiftNumber} วันที่ ${toBangkokDateKey(staleShift.dailyRecord.date)}`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    const startGaugeCount = gaugeReadings.filter((reading) => reading.notes === 'start').length;
    const endGaugeCount = gaugeReadings.filter((reading) => reading.notes === 'end').length;

    if (openShift && (openShift.meters.length < 4 || startGaugeCount < 3)) {
        workItems.push({
            id: `opening-data:${openShift.id}`,
            type: 'MISSING_OPENING_DATA',
            severity: 'warning',
            title: 'ข้อมูลเปิดกะยังไม่ครบ',
            detail: `มิเตอร์ ${openShift.meters.length}/4 · เกจ ${startGaugeCount}/3`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    if (openShift) {
        const endMeterCount = openShift.meters.filter((meter) => meter.endReading !== null).length;
        const hasStartedClosing = endMeterCount > 0 || endGaugeCount > 0;
        if (hasStartedClosing && (endMeterCount < 4 || endGaugeCount < 3)) {
            workItems.push({
                id: `closing-data:${openShift.id}`,
                type: 'MISSING_CLOSING_DATA',
                severity: 'warning',
                title: 'ข้อมูลปิดกะยังไม่ครบ',
                detail: `มิเตอร์ ${endMeterCount}/4 · เกจ ${endGaugeCount}/3`,
                href: paths.attention,
                stationId: station.id,
                stationName: station.name,
            });
        }
    }

    for (const anomaly of shift?.anomalies || []) {
        workItems.push({
            id: `meter-anomaly:${anomaly.id}`,
            type: 'METER_ANOMALY',
            severity: anomaly.severity === 'CRITICAL' ? 'critical' : 'warning',
            title: `มิเตอร์หัว ${anomaly.nozzleNumber} ผิดปกติ`,
            detail: `ต่างจากค่าเฉลี่ย ${Number(anomaly.percentDiff).toFixed(1)}%`,
            href: '/admin/anomalies',
            stationId: station.id,
            stationName: station.name,
        });
    }

    if (shift?.reconciliation && shift.reconciliation.varianceStatus !== 'GREEN') {
        workItems.push({
            id: `variance:${shift.reconciliation.id}`,
            type: 'RECONCILIATION_VARIANCE',
            severity: shift.reconciliation.varianceStatus === 'RED' ? 'critical' : 'warning',
            title: 'ยอดกระทบกะมีผลต่าง',
            detail: `${Number(shift.reconciliation.variance).toFixed(2)} บาท`,
            href: paths.attention,
            stationId: station.id,
            stationName: station.name,
        });
    }

    workItems.push(...transactionWorkItems(transactions, station, false));
    workItems.push(...transactionWorkItems(unlinkedTransactions, station, true));

    const endMetersComplete = Boolean(
        openShift &&
        openShift.meters.length >= 4 &&
        openShift.meters.every((meter) => meter.endReading !== null)
    );
    const closingComplete = endMetersComplete && endGaugeCount >= 3;
    const maxShifts = STATION_STAFF[station.id]?.maxShifts || 2;

    let state: Exclude<TodayStationState, 'RETIRED'>;
    if (staleShift && staleShift.id !== openShift?.id) {
        state = 'STALE_SHIFT';
    } else if (openShift) {
        state = hasAttention(workItems)
            ? 'SHIFT_NEEDS_ATTENTION'
            : closingComplete
                ? 'READY_TO_CLOSE'
                : 'SHIFT_OPEN';
    } else if (latestCurrentShift && currentShiftCount >= maxShifts) {
        state = 'CLOSED';
    } else {
        state = 'NO_SHIFT';
    }

    return {
        stationId: station.id,
        stationName: station.name,
        stationType: 'GAS',
        stationNumber: getStationNumber(station.id),
        state,
        stateLabel: stateLabels[state],
        shift: shift
            ? {
                id: shift.id,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                staffName: shift.staff?.name || null,
                openedAt: shift.createdAt.toISOString(),
                closedAt: shift.closedAt?.toISOString() || null,
                businessDate: toBangkokDateKey(shift.dailyRecord.date),
            }
            : null,
        primaryAction: getPrimaryAction(state, station),
        workItems: dedupeAndSortWorkItems(workItems),
        summary: summarizeTransactions(transactions),
        recentTransactions: transactions.slice(0, 5).map((row) => toTodayTransaction(row, station)),
        href: paths.base,
    };
}

async function buildActiveStationSnapshot(station: ActiveStationConfig): Promise<TodayStationSnapshot> {
    return station.type === 'FULL'
        ? buildFullStationSnapshot(station)
        : buildGasStationSnapshot(station);
}

async function getBillingAttention(): Promise<TodayBillingAttention> {
    const now = new Date();
    const [readyToInvoice, invoices, collections, pendingPaymentSlips] = await Promise.all([
        prisma.transaction.aggregate({
            where: {
                paymentType: { in: [...CREDIT_PAYMENT_TYPES] },
                invoiceId: null,
                deletedAt: null,
                isVoided: false,
            },
            _count: { _all: true },
            _sum: { amount: true },
        }),
        prisma.invoice.findMany({
            where: { status: { in: ['PENDING', 'PARTIAL'] } },
            select: { totalAmount: true, paidAmount: true, dueDate: true },
        }),
        prisma.billingCollection.findMany({
            where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
            select: { totalAmount: true, paidAmount: true, dueDate: true, status: true },
        }),
        prisma.paymentSlip.count({ where: { status: 'PENDING' } }),
    ]);

    const invoiceOutstanding = invoices.reduce(
        (sum, invoice) => sum + Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount)),
        0
    );
    const collectionOutstanding = collections.reduce(
        (sum, collection) => sum + Math.max(0, Number(collection.totalAmount) - Number(collection.paidAmount)),
        0
    );
    const overdueInvoices = invoices.filter((invoice) => invoice.dueDate && invoice.dueDate < now).length;
    const overdueCollections = collections.filter(
        (collection) => collection.status === 'OVERDUE' || (collection.dueDate && collection.dueDate < now)
    ).length;

    return {
        readyToInvoice: {
            transactionCount: readyToInvoice._count._all,
            amount: Number(readyToInvoice._sum.amount || 0),
        },
        invoiceAwaitingPayment: {
            documentCount: invoices.length,
            amount: invoiceOutstanding,
        },
        collectionAwaitingPayment: {
            documentCount: collections.length,
            amount: collectionOutstanding,
        },
        overdueDocuments: overdueInvoices + overdueCollections,
        pendingPaymentSlips,
    };
}

function buildTodayUser(
    authUser: { id: string; name: string; role: 'ADMIN' | 'STAFF'; stationId: string | null },
    station: StationConfig | null
): TodayUser {
    return {
        id: authUser.id,
        name: authUser.name,
        role: authUser.role,
        stationId: station?.id || authUser.stationId,
        stationName: station?.name || null,
        stationType: station?.type || null,
    };
}

async function buildAdminPayload(user: TodayUser): Promise<TodayAdminPayload> {
    const activeStations = STATIONS.filter(
        (station): station is ActiveStationConfig => ACTIVE_STATION_IDS.includes(station.id as (typeof ACTIVE_STATION_IDS)[number])
    );

    const [stations, billing, pendingMeterAnomalies, pendingDailyAnomalies, recentRows] = await Promise.all([
        Promise.all(activeStations.map(buildActiveStationSnapshot)),
        getBillingAttention(),
        prisma.meterAnomaly.findMany({
            where: {
                reviewedAt: null,
                shift: { dailyRecord: { stationId: { in: [...ACTIVE_STATION_IDS] } } },
            },
            include: {
                shift: {
                    select: {
                        dailyRecord: {
                            select: {
                                stationId: true,
                                station: { select: { name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
        prisma.dailyAnomaly.findMany({
            where: { reviewedAt: null, stationId: { in: [...ACTIVE_STATION_IDS] } },
            include: { station: { select: { name: true } } },
            orderBy: { date: 'desc' },
            take: 20,
        }),
        prisma.transaction.findMany({
            where: {
                stationId: { in: [...ACTIVE_STATION_IDS] },
                deletedAt: null,
                isVoided: false,
            },
            select: {
                id: true,
                stationId: true,
                date: true,
                licensePlate: true,
                ownerId: true,
                ownerName: true,
                paymentType: true,
                liters: true,
                amount: true,
                transferProofUrl: true,
                shiftId: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
        }),
    ]);

    const stationWorkItems = stations.flatMap((station) => station.workItems);
    const meterAnomalyItems: TodayWorkItem[] = pendingMeterAnomalies.map((anomaly) => ({
        id: `meter-anomaly:${anomaly.id}`,
        type: 'METER_ANOMALY',
        severity: anomaly.severity === 'CRITICAL' ? 'critical' : 'warning',
        title: `${anomaly.shift.dailyRecord.station.name}: มิเตอร์หัว ${anomaly.nozzleNumber} ผิดปกติ`,
        detail: `ต่างจากค่าเฉลี่ย ${Number(anomaly.percentDiff).toFixed(1)}%`,
        href: '/admin/anomalies',
        stationId: anomaly.shift.dailyRecord.stationId,
        stationName: anomaly.shift.dailyRecord.station.name,
    }));
    const dailyAnomalyItems: TodayWorkItem[] = pendingDailyAnomalies.map((anomaly) => ({
        id: `daily-anomaly:${anomaly.id}`,
        type: 'DAILY_ANOMALY',
        severity: anomaly.severity === 'CRITICAL' ? 'critical' : 'warning',
        title: `${anomaly.station.name}: ยอดมิเตอร์ไม่ตรงกับรายการขาย`,
        detail: `ผลต่าง ${Number(anomaly.difference).toFixed(2)} ลิตร`,
        href: '/admin/daily-anomalies',
        stationId: anomaly.stationId,
        stationName: anomaly.station.name,
    }));

    const recentActivity = recentRows.map((row) => {
        const station = resolveStationConfig(row.stationId) || STATIONS[0];
        return toTodayTransaction(row, station);
    });

    return {
        kind: 'admin',
        dateKey: getTodayBangkok(),
        user,
        workItems: dedupeAndSortWorkItems([...stationWorkItems, ...meterAnomalyItems, ...dailyAnomalyItems]),
        stations,
        billing,
        recentActivity,
    };
}

async function buildStaffPayload(user: TodayUser, station: StationConfig): Promise<TodayStaffPayload> {
    const stationNumber = getStationNumber(station.id);

    if (RETIRED_STATION_IDS.includes(station.id as (typeof RETIRED_STATION_IDS)[number])) {
        return {
            kind: 'staff',
            dateKey: getTodayBangkok(),
            user,
            station: {
                stationId: station.id,
                stationName: station.name,
                stationType: station.type,
                stationNumber,
            },
            state: 'RETIRED',
            stateLabel: stateLabels.RETIRED,
            shift: null,
            primaryAction: { label: 'ดูข้อมูลย้อนหลัง', href: '/reports' },
            workItems: [],
            summary: { transactionCount: 0, liters: 0, amount: 0 },
            recentTransactions: [],
        };
    }

    if (station.type !== 'FULL' && station.type !== 'GAS') {
        throw new Error('Unsupported active station type');
    }

    const snapshot = await buildActiveStationSnapshot(station);

    return {
        kind: 'staff',
        dateKey: snapshot.shift?.businessDate || getTodayBangkok(),
        user,
        station: {
            stationId: station.id,
            stationName: station.name,
            stationType: station.type,
            stationNumber,
        },
        state: snapshot.state,
        stateLabel: snapshot.stateLabel,
        shift: snapshot.shift,
        primaryAction: snapshot.primaryAction,
        workItems: snapshot.workItems,
        summary: snapshot.summary,
        recentTransactions: snapshot.recentTransactions,
    };
}

export async function GET() {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const station = resolveStationConfig(auth.user.stationId);
        const user = buildTodayUser(auth.user, station);

        if (auth.user.role === 'ADMIN') {
            return NextResponse.json(await withPrismaReadRetry(() => buildAdminPayload(user)));
        }

        if (!station) {
            return NextResponse.json({ error: 'ไม่พบสถานีของผู้ใช้' }, { status: 400 });
        }

        return NextResponse.json(await withPrismaReadRetry(() => buildStaffPayload(user, station)));
    } catch (error) {
        console.error('[Today API]:', error);
        return NextResponse.json({ error: 'Failed to build Today workspace' }, { status: 500 });
    }
}
