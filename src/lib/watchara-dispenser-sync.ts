import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import {
    WATCHARA_DEFAULT_SHIFT_KEY,
    WATCHARA_DISPENSER_SOURCE_CODE,
    WATCHARA_DISPENSER_SOURCE_NAME,
    WATCHARA_EXTERNAL_STATION_REF,
    WATCHARA_FUEL_FAMILY,
    WATCHARA_LOCAL_STATION_ID,
    WATCHARA_ROLLUP_MODE,
    getWatcharaDispenserDatabaseUrl,
    getWatcharaDispenserStaleInfo,
    validateWatcharaSyncDateRange,
} from '@/lib/watchara-dispenser-utils';
import {
    WatcharaDispenserTransaction,
    fetchWatcharaDispenserLatestTransactionAt,
    fetchWatcharaDispenserTransactions,
} from '@/lib/watchara-dispenser-client';

export interface WatcharaDispenserSyncOptions {
    startDate?: string;
    endDate?: string;
    dryRun?: boolean;
    triggeredByUserId?: string | null;
}

export interface WatcharaDispenserSyncResult {
    sourceCode: string;
    startDate: string;
    endDate: string;
    dayCount: number;
    dryRun: boolean;
    rowsFetched: number;
    created: number;
    updated: number;
    latestSourceTransactionAt: string | null;
    stale: {
        isStale: boolean;
        staleHours: number | null;
        thresholdHours: number;
    };
}

export function isMissingWatcharaExternalTablesError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

interface WatcharaDispenserStatusOptions {
    probeLive?: boolean;
}

function getSyncWindow(options: WatcharaDispenserSyncOptions) {
    const startDate = options.startDate || getTodayBangkok();
    const endDate = options.endDate || startDate;
    return validateWatcharaSyncDateRange(startDate, endDate);
}

type WatcharaSourceClient = Pick<Prisma.TransactionClient, 'station' | 'externalSalesSource'>;

async function ensureWatcharaTargetStationExists(client: WatcharaSourceClient = prisma) {
    const station = await client.station.findUnique({
        where: { id: WATCHARA_LOCAL_STATION_ID },
        select: { id: true, name: true },
    });

    if (!station) {
        throw new Error(`Target station "${WATCHARA_LOCAL_STATION_ID}" was not found in the local database`);
    }

    return station;
}

async function upsertWatcharaSalesSource(client: WatcharaSourceClient) {
    await ensureWatcharaTargetStationExists(client);
    return client.externalSalesSource.upsert({
        where: { code: WATCHARA_DISPENSER_SOURCE_CODE },
        create: {
            code: WATCHARA_DISPENSER_SOURCE_CODE,
            name: WATCHARA_DISPENSER_SOURCE_NAME,
            stationId: WATCHARA_LOCAL_STATION_ID,
            sourceStationRef: WATCHARA_EXTERNAL_STATION_REF,
            fuelFamily: WATCHARA_FUEL_FAMILY,
            rollupMode: WATCHARA_ROLLUP_MODE,
            isEnabled: true,
        },
        update: {
            name: WATCHARA_DISPENSER_SOURCE_NAME,
            stationId: WATCHARA_LOCAL_STATION_ID,
            sourceStationRef: WATCHARA_EXTERNAL_STATION_REF,
            fuelFamily: WATCHARA_FUEL_FAMILY,
            rollupMode: WATCHARA_ROLLUP_MODE,
            isEnabled: true,
        },
    });
}

export async function ensureWatcharaSalesSource() {
    return upsertWatcharaSalesSource(prisma);
}

export async function bootstrapWatcharaSalesSource(userId: string) {
    return prisma.$transaction(async (tx) => {
        const source = await upsertWatcharaSalesSource(tx);
        await tx.auditLog.create({
            data: {
                userId,
                action: 'WATCHARA_DISPENSER_BOOTSTRAP',
                model: 'ExternalSalesSource',
                recordId: WATCHARA_DISPENSER_SOURCE_CODE,
                newData: {
                    sourceId: source.id,
                    code: source.code,
                    stationId: source.stationId,
                    sourceStationRef: source.sourceStationRef,
                    fuelFamily: source.fuelFamily,
                    rollupMode: source.rollupMode,
                    isEnabled: source.isEnabled,
                },
            },
        });
        return source;
    }, { maxWait: 5_000, timeout: 20_000 });
}

function toLocalExternalTransactionInput(
    sourceId: string,
    row: WatcharaDispenserTransaction,
    syncedAt: Date
): Prisma.ExternalDispenserTransactionUncheckedCreateInput {
    return {
        sourceId,
        stationId: WATCHARA_LOCAL_STATION_ID,
        externalTxId: row.externalTxId,
        externalStationRef: row.externalStationRef,
        externalDailyRecordRef: row.externalDailyRecordRef,
        soldAt: row.soldAt,
        businessDate: getStartOfDayBangkok(row.businessDate),
        shiftKey: WATCHARA_DEFAULT_SHIFT_KEY,
        nozzleNumber: row.nozzleNumber,
        fuelFamily: WATCHARA_FUEL_FAMILY,
        productLabel: row.productLabel,
        liters: row.liters,
        amountBaht: row.amountBaht,
        pricePerLiter: row.pricePerLiter,
        paymentType: row.paymentType,
        billNo: row.billNo,
        recordedByRef: row.recordedByRef,
        rawJson: row.rawJson,
        sourceUpdatedAt: row.sourceUpdatedAt || row.soldAt,
        isVoided: row.isVoided,
        isDeleted: row.isDeleted,
        syncedAt,
    };
}

async function getExistingExternalTransactionIds(sourceId: string, externalTxIds: string[]) {
    if (externalTxIds.length === 0) {
        return new Set<string>();
    }

    const rows = await prisma.externalDispenserTransaction.findMany({
        where: {
            sourceId,
            externalTxId: { in: externalTxIds },
        },
        select: { externalTxId: true },
    });

    return new Set(rows.map((row) => row.externalTxId));
}

async function recordSyncAuditLog(userId: string | null | undefined, result: WatcharaDispenserSyncResult) {
    if (!userId) return;

    await prisma.auditLog.create({
        data: {
            userId,
            action: result.dryRun ? 'WATCHARA_DISPENSER_DRY_RUN' : 'WATCHARA_DISPENSER_SYNC',
            model: 'ExternalSalesSource',
            recordId: WATCHARA_DISPENSER_SOURCE_CODE,
            newData: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        },
    });
}

export async function syncWatcharaDispenser(
    options: WatcharaDispenserSyncOptions = {}
): Promise<WatcharaDispenserSyncResult> {
    if (!getWatcharaDispenserDatabaseUrl()) {
        throw new Error('WATCHARA_DISPENSER_DATABASE_URL is not configured');
    }

    const { startDate, endDate, dayCount } = getSyncWindow(options);
    const dryRun = options.dryRun === true;

    let source = dryRun
        ? await prisma.externalSalesSource.findUnique({
            where: { code: WATCHARA_DISPENSER_SOURCE_CODE },
            select: { id: true, lastSeenSourceAt: true },
        })
        : null;

    if (!dryRun) {
        source = await ensureWatcharaSalesSource();
        await prisma.externalSalesSource.update({
            where: { id: source.id },
            data: {
                lastSyncAttemptAt: new Date(),
                lastError: null,
            },
        });
    }

    try {
        const [rows, latestSourceTransactionAt] = await Promise.all([
            fetchWatcharaDispenserTransactions(startDate, endDate),
            fetchWatcharaDispenserLatestTransactionAt(),
        ]);

        const existingIds = source
            ? await getExistingExternalTransactionIds(source.id, rows.map((row) => row.externalTxId))
            : new Set<string>();

        const created = rows.filter((row) => !existingIds.has(row.externalTxId)).length;
        const updated = rows.length - created;
        const stale = getWatcharaDispenserStaleInfo(latestSourceTransactionAt);

        const result: WatcharaDispenserSyncResult = {
            sourceCode: WATCHARA_DISPENSER_SOURCE_CODE,
            startDate,
            endDate,
            dayCount,
            dryRun,
            rowsFetched: rows.length,
            created,
            updated,
            latestSourceTransactionAt: latestSourceTransactionAt?.toISOString() || null,
            stale,
        };

        if (dryRun) {
            await recordSyncAuditLog(options.triggeredByUserId, result);
            return result;
        }

        if (!source) {
            throw new Error('Failed to initialize the Watchara external sales source');
        }

        const syncedAt = new Date();
        await prisma.$transaction(async (tx) => {
            for (const row of rows) {
                await tx.externalDispenserTransaction.upsert({
                    where: {
                        sourceId_externalTxId: {
                            sourceId: source.id,
                            externalTxId: row.externalTxId,
                        },
                    },
                    create: toLocalExternalTransactionInput(source.id, row, syncedAt),
                    update: toLocalExternalTransactionInput(source.id, row, syncedAt),
                });
            }

            await tx.externalSalesSource.update({
                where: { id: source.id },
                data: {
                    lastSyncAttemptAt: syncedAt,
                    lastSyncedAt: syncedAt,
                    lastSeenSourceAt: latestSourceTransactionAt || source.lastSeenSourceAt,
                    lastError: null,
                },
            });

            if (options.triggeredByUserId) {
                await tx.auditLog.create({
                    data: {
                        userId: options.triggeredByUserId,
                        action: 'WATCHARA_DISPENSER_SYNC',
                        model: 'ExternalSalesSource',
                        recordId: WATCHARA_DISPENSER_SOURCE_CODE,
                        newData: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
                    },
                });
            }
        }, { maxWait: 5_000, timeout: 30_000 });

        return result;
    } catch (error) {
        if (isMissingWatcharaExternalTablesError(error)) {
            throw new Error('External Watchara tables are not available yet. Run prisma db push before syncing.');
        }

        const message = error instanceof Error ? error.message : 'Unknown Watchara sync error';

        if (!dryRun && source) {
            await prisma.externalSalesSource.update({
                where: { id: source.id },
                data: {
                    lastSyncAttemptAt: new Date(),
                    lastError: message,
                },
            });
        }

        throw error;
    }
}

export async function getWatcharaDispenserStatus(
    options: WatcharaDispenserStatusOptions = {}
) {
    const hasExternalDatabaseUrl = Boolean(getWatcharaDispenserDatabaseUrl());
    let source = null;
    let transactionAggregate = null;
    let recent7DayCount = 0;
    let schemaReady = true;
    let schemaError: string | null = null;

    try {
        source = await prisma.externalSalesSource.findUnique({
            where: { code: WATCHARA_DISPENSER_SOURCE_CODE },
            include: {
                station: {
                    select: { id: true, name: true },
                },
            },
        });

        transactionAggregate = source
            ? await prisma.externalDispenserTransaction.aggregate({
                where: { sourceId: source.id },
                _count: { id: true },
                _max: {
                    soldAt: true,
                    businessDate: true,
                    syncedAt: true,
                },
            })
            : null;

        recent7DayCount = source
            ? await prisma.externalDispenserTransaction.count({
                where: {
                    sourceId: source.id,
                    businessDate: {
                        gte: (() => {
                            const start = getStartOfDayBangkok(getTodayBangkok());
                            start.setUTCDate(start.getUTCDate() - 6);
                            return start;
                        })(),
                    },
                },
            })
            : 0;
    } catch (error) {
        if (isMissingWatcharaExternalTablesError(error)) {
            schemaReady = false;
            schemaError = 'External Watchara tables are not available yet. Run prisma db push first.';
        } else {
            throw error;
        }
    }

    let liveProbe: {
        attempted: boolean;
        latestTransactionAt: string | null;
        error: string | null;
    } = {
        attempted: false,
        latestTransactionAt: null,
        error: null,
    };

    if (options.probeLive && hasExternalDatabaseUrl) {
        liveProbe = {
            attempted: true,
            latestTransactionAt: null,
            error: null,
        };

        try {
            const latest = await fetchWatcharaDispenserLatestTransactionAt();
            liveProbe.latestTransactionAt = latest?.toISOString() || null;
        } catch (error) {
            liveProbe.error = error instanceof Error ? error.message : 'Unknown live probe error';
        }
    }

    const lastSeenSourceAt = source?.lastSeenSourceAt || transactionAggregate?._max.soldAt || null;
    const stale = getWatcharaDispenserStaleInfo(lastSeenSourceAt);

    return {
        sourceCode: WATCHARA_DISPENSER_SOURCE_CODE,
        sourceName: WATCHARA_DISPENSER_SOURCE_NAME,
        env: {
            hasExternalDatabaseUrl,
        },
        schema: {
            ready: schemaReady,
            error: schemaError,
        },
        mapping: {
            localStationId: WATCHARA_LOCAL_STATION_ID,
            externalStationRef: WATCHARA_EXTERNAL_STATION_REF,
            fuelFamily: WATCHARA_FUEL_FAMILY,
            rollupMode: WATCHARA_ROLLUP_MODE,
            shiftKey: WATCHARA_DEFAULT_SHIFT_KEY,
        },
        source: source
            ? {
                id: source.id,
                isEnabled: source.isEnabled,
                station: source.station,
                lastSyncAttemptAt: source.lastSyncAttemptAt?.toISOString() || null,
                lastSyncedAt: source.lastSyncedAt?.toISOString() || null,
                lastSeenSourceAt: source.lastSeenSourceAt?.toISOString() || null,
                lastError: source.lastError,
            }
            : null,
        localLanding: {
            transactionCount: transactionAggregate?._count.id || 0,
            latestSoldAt: transactionAggregate?._max.soldAt?.toISOString() || null,
            latestBusinessDate: transactionAggregate?._max.businessDate?.toISOString() || null,
            latestSyncedAt: transactionAggregate?._max.syncedAt?.toISOString() || null,
            recent7DayCount,
        },
        liveProbe,
        stale,
    };
}
