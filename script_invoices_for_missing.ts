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
            invoiceId: true,
        },
    });

    const invoiceIds = [...new Set(boxTruckTxs.map(t => t.invoiceId))];

    console.log(`Found ${invoiceIds.length} unique invoices that contain these transactions.`);

    const invoices = await prisma.invoice.findMany({
        where: {
            id: { in: invoiceIds as string[] }
        },
        select: {
            id: true,
            invoiceNumber: true,
            createdAt: true,
            status: true,
            totalAmount: true
        },
        orderBy: { createdAt: 'asc' }
    });

    for (const inv of invoices) {
        console.log(`Invoice: ${inv.invoiceNumber} | Date: ${inv.createdAt.toISOString().split('T')[0]} | Status: ${inv.status} | Total: ${inv.totalAmount}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
