import { Prisma, PrismaClient } from '@prisma/client';
import { getEndOfDayBangkok, getStartOfDayBangkok } from '@/lib/date-utils';
import {
    WATCHARA_EXTERNAL_STATION_REF,
    WATCHARA_FUEL_FAMILY,
    getWatcharaDispenserDatabaseUrl,
    normalizeWatcharaBusinessDate,
} from '@/lib/watchara-dispenser-utils';

interface RawWatcharaDispenserTransactionRow {
    externalTxId: string;
    externalStationRef: string;
    externalDailyRecordRef: string | null;
    soldAt: Date;
    businessDateAnchor: Date;
    nozzleNumber: number | null;
    productLabel: string | null;
    liters: string;
    amountBaht: string;
    pricePerLiter: string | null;
    paymentType: string | null;
    billNo: string | null;
    recordedByRef: string | null;
    sourceUpdatedAt: Date | null;
    isVoided: boolean;
    isDeleted: boolean;
}

interface RawWatcharaLatestTransactionRow {
    latestTransactionAt: Date | null;
}

export interface WatcharaDispenserTransaction {
    externalTxId: string;
    externalStationRef: string;
    externalDailyRecordRef: string | null;
    soldAt: Date;
    businessDate: string;
    nozzleNumber: number | null;
    fuelFamily: string;
    productLabel: string;
    liters: string;
    amountBaht: string;
    pricePerLiter: string | null;
    paymentType: string | null;
    billNo: string | null;
    recordedByRef: string | null;
    sourceUpdatedAt: Date | null;
    isVoided: boolean;
    isDeleted: boolean;
    rawJson: Prisma.InputJsonValue;
}

const globalForWatcharaDispenser = globalThis as unknown as {
    watcharaDispenserClient?: PrismaClient;
};

function getWatcharaDispenserClient(): PrismaClient {
    const databaseUrl = getWatcharaDispenserDatabaseUrl();
    if (!databaseUrl) {
        throw new Error('WATCHARA_DISPENSER_DATABASE_URL is not configured');
    }

    if (!globalForWatcharaDispenser.watcharaDispenserClient) {
        globalForWatcharaDispenser.watcharaDispenserClient = new PrismaClient({
            datasources: {
                db: {
                    url: databaseUrl,
                },
            },
        });
    }

    return globalForWatcharaDispenser.watcharaDispenserClient;
}

function normalizeWatcharaTransactionRow(
    row: RawWatcharaDispenserTransactionRow
): WatcharaDispenserTransaction {
    const businessDate = normalizeWatcharaBusinessDate(row.businessDateAnchor);
    const productLabel = row.productLabel || WATCHARA_FUEL_FAMILY;

    return {
        externalTxId: row.externalTxId,
        externalStationRef: row.externalStationRef,
        externalDailyRecordRef: row.externalDailyRecordRef,
        soldAt: row.soldAt,
        businessDate,
        nozzleNumber: row.nozzleNumber,
        fuelFamily: WATCHARA_FUEL_FAMILY,
        productLabel,
        liters: row.liters,
        amountBaht: row.amountBaht,
        pricePerLiter: row.pricePerLiter,
        paymentType: row.paymentType,
        billNo: row.billNo,
        recordedByRef: row.recordedByRef,
        sourceUpdatedAt: row.sourceUpdatedAt,
        isVoided: row.isVoided,
        isDeleted: row.isDeleted,
        rawJson: {
            externalTxId: row.externalTxId,
            externalStationRef: row.externalStationRef,
            externalDailyRecordRef: row.externalDailyRecordRef,
            soldAt: row.soldAt.toISOString(),
            businessDateAnchor: row.businessDateAnchor.toISOString(),
            nozzleNumber: row.nozzleNumber,
            productLabel: row.productLabel,
            liters: row.liters,
            amountBaht: row.amountBaht,
            pricePerLiter: row.pricePerLiter,
            paymentType: row.paymentType,
            billNo: row.billNo,
            recordedByRef: row.recordedByRef,
            sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() || null,
            isVoided: row.isVoided,
            isDeleted: row.isDeleted,
        },
    };
}

export async function fetchWatcharaDispenserTransactions(
    startDate: string,
    endDate: string
): Promise<WatcharaDispenserTransaction[]> {
    const client = getWatcharaDispenserClient();
    const startOfDay = getStartOfDayBangkok(startDate);
    const endOfDay = getEndOfDayBangkok(endDate);

    const rows = await client.$queryRaw<RawWatcharaDispenserTransactionRow[]>(Prisma.sql`
        SELECT
            t.id::text AS "externalTxId",
            t."stationId"::text AS "externalStationRef",
            t."dailyRecordId"::text AS "externalDailyRecordRef",
            t.date AS "soldAt",
            COALESCE(dr.date, t.date) AS "businessDateAnchor",
            t."nozzleNumber" AS "nozzleNumber",
            NULLIF(t."productType", '')::text AS "productLabel",
            t.liters::text AS "liters",
            t.amount::text AS "amountBaht",
            t."pricePerLiter"::text AS "pricePerLiter",
            t."paymentType"::text AS "paymentType",
            t."billNo"::text AS "billNo",
            t."recordedById"::text AS "recordedByRef",
            t."updatedAt" AS "sourceUpdatedAt",
            COALESCE(t."isVoided", false) AS "isVoided",
            (t."deletedAt" IS NOT NULL) AS "isDeleted"
        FROM "transactions" t
        LEFT JOIN "daily_records" dr ON dr.id = t."dailyRecordId"
        WHERE t."stationId" = ${WATCHARA_EXTERNAL_STATION_REF}
          AND t.date >= ${startOfDay}
          AND t.date <= ${endOfDay}
        ORDER BY t.date ASC, t.id ASC
    `);

    return rows.map(normalizeWatcharaTransactionRow);
}

export async function fetchWatcharaDispenserLatestTransactionAt(): Promise<Date | null> {
    const client = getWatcharaDispenserClient();

    const rows = await client.$queryRaw<RawWatcharaLatestTransactionRow[]>(Prisma.sql`
        SELECT MAX(t.date) AS "latestTransactionAt"
        FROM "transactions" t
        WHERE t."stationId" = ${WATCHARA_EXTERNAL_STATION_REF}
    `);

    return rows[0]?.latestTransactionAt || null;
}
