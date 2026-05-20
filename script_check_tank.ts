import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1'; // แท๊งลอยวัชรเกียรติ
    const d = new Date('2026-02-06T00:00:00.000Z');
    const next = new Date('2026-02-07T00:00:00.000Z');

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: STATION_ID,
            createdAt: { gte: d, lt: next }
        },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Transactions on Feb 6: ${txs.length}`);
    let runningAmount = 0;
    let runningLiters = 0;

    for (const t of txs) {
        console.log(`[${t.createdAt.toISOString()}] Type: ${t.paymentType.padEnd(15)} | ${t.productType?.padEnd(10) || 'None'} | Qty: ${Number(t.liters).toFixed(2).padStart(8)} L | Price: ฿${Number(t.pricePerLiter).toFixed(2).padStart(5)} | Total: ฿${Number(t.amount).toFixed(2).padStart(10)} | Customer: ${(t.ownerName || '-').padEnd(20)} | Truck: ${t.licensePlate || '-'}`);
        runningAmount += Number(t.amount);
        runningLiters += Number(t.liters);
    }

    console.log(`\nTotal Liters: ${runningLiters.toFixed(2)} L`);
    console.log(`Total Amount: ฿${runningAmount.toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
