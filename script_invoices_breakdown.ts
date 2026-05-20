import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const startDate = new Date('2026-01-28T00:00:00.000Z');
    const endDate = new Date('2026-02-08T00:00:00.000Z');

    const boxTruckTxs = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            date: {
                gte: startDate,
                lt: endDate
            },
            invoiceId: { not: null }
        },
        select: {
            id: true,
            date: true,
            invoiceId: true,
            ownerName: true,
            amount: true,
            invoice: {
                select: {
                    invoiceNumber: true,
                    status: true,
                    createdAt: true
                }
            }
        },
        orderBy: { date: 'asc' }
    });

    const groups: Record<string, { count: number, total: number, earliest: string, latest: string }> = {};

    for (const t of boxTruckTxs) {
        if (!t.invoice) continue;

        const invNum = t.invoice.invoiceNumber;
        if (!groups[invNum]) {
            groups[invNum] = { count: 0, total: 0, earliest: t.date.toISOString(), latest: t.date.toISOString() };
        }

        groups[invNum].count++;
        groups[invNum].total += Number(t.amount);

        if (t.date.toISOString() < groups[invNum].earliest) groups[invNum].earliest = t.date.toISOString();
        if (t.date.toISOString() > groups[invNum].latest) groups[invNum].latest = t.date.toISOString();
    }

    console.log(`\n=== Distribution of 190 Jan 28 - Feb 7 transactions ===`);
    for (const [invNum, stats] of Object.entries(groups)) {
        console.log(`Invoice ${invNum} | Contains ${stats.count} txs | Total Tx Amount in Range: ${stats.total.toFixed(2)}`);
        console.log(`  Date Range of these txs: ${stats.earliest.split('T')[0]} to ${stats.latest.split('T')[0]}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
