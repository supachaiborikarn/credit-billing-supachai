import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const startDate = new Date('2026-01-28T00:00:00.000Z');
    const endDate = new Date('2026-02-08T00:00:00.000Z');

    console.log(`Searching for BOX_TRUCK transactions between ${startDate.toISOString()} and ${endDate.toISOString()}`);

    const boxTruckTxs = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            date: {
                gte: startDate,
                lt: endDate
            },
            deletedAt: null,
            isVoided: false
        },
        select: {
            id: true,
            date: true,
            ownerName: true,
            ownerId: true,
            amount: true,
            invoiceId: true,
            licensePlate: true
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Found ${boxTruckTxs.length} BOX_TRUCK transactions in this date range.`);

    let unlinkedCount = 0;
    let invoicedCount = 0;
    let pendingCount = 0;

    for (const t of boxTruckTxs) {
        if (!t.ownerId) {
            unlinkedCount++;
            console.log(`No ownerId: ${t.date.toISOString()} | Name: ${t.ownerName} | Amt: ${t.amount}`);
        } else if (t.invoiceId) {
            invoicedCount++;
        } else {
            pendingCount++;
            console.log(`Pending: ${t.date.toISOString()} | OwnerId: ${t.ownerId} | Name: ${t.ownerName} | Amt: ${t.amount}`);
        }
    }

    console.log(`\nSummary for Jan 28 - Feb 7:`);
    console.log(`Total: ${boxTruckTxs.length}`);
    console.log(`Missing ownerId (Unlinked): ${unlinkedCount}`);
    console.log(`Already in an Invoice: ${invoicedCount}`);
    console.log(`Pending (Ready for Invoice): ${pendingCount}`);


    // Check if the system records BOX_TRUCKs completely differently before a certain date
    const allBoxTrucksAllTime = await prisma.transaction.aggregate({
        where: { paymentType: 'BOX_TRUCK' },
        _min: { date: true },
        _max: { date: true },
        _count: true
    });

    console.log(`\nOverall BOX_TRUCK stats: Count=${allBoxTrucksAllTime._count}, MinDate=${allBoxTrucksAllTime._min.date}, MaxDate=${allBoxTrucksAllTime._max.date}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
