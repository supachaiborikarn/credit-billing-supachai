import { prisma } from '@/lib/prisma';

const numericBillPattern = /^\d+$/;

function buildNextBillNo(existingBillNos: Array<string | null>): string {
    const numericBills = existingBillNos
        .map((value) => value?.trim() || '')
        .filter((value) => numericBillPattern.test(value))
        .map((value) => ({ value: Number.parseInt(value, 10), width: value.length }))
        .filter((item) => Number.isFinite(item.value));

    if (numericBills.length === 0) {
        return '1';
    }

    const maxBill = Math.max(...numericBills.map((item) => item.value));
    const width = Math.max(String(maxBill + 1).length, ...numericBills.map((item) => item.width));
    return String(maxBill + 1).padStart(width, '0');
}

async function getLatestBillBookNo(stationId: string): Promise<string | null> {
    const latest = await prisma.transaction.findFirst({
        where: {
            stationId,
            billBookNo: { not: null },
            deletedAt: null,
            isVoided: false,
        },
        orderBy: [
            { date: 'desc' },
            { createdAt: 'desc' },
        ],
        select: { billBookNo: true },
    });

    return latest?.billBookNo?.trim() || null;
}

export async function suggestNextStationBill(stationId: string, requestedBookNo?: string | null) {
    const bookNo = requestedBookNo?.trim() || await getLatestBillBookNo(stationId);

    if (!bookNo) {
        return { bookNo: null, billNo: null };
    }

    const existing = await prisma.transaction.findMany({
        where: {
            stationId,
            billBookNo: bookNo,
            billNo: { not: null },
            deletedAt: null,
            isVoided: false,
        },
        select: { billNo: true },
    });

    return {
        bookNo,
        billNo: buildNextBillNo(existing.map((row) => row.billNo)),
    };
}
