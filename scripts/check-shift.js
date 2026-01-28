const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const today = new Date('2026-01-28');
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('=== Transactions by Station for Today ===\n');

    const txs = await prisma.transaction.findMany({
        where: {
            date: { gte: today, lt: tomorrow }
        },
        include: { station: true },
        orderBy: { date: 'asc' }
    });

    // Group by station
    const byStation = {};
    txs.forEach(tx => {
        const key = tx.stationId;
        if (!byStation[key]) byStation[key] = { name: tx.station?.name || 'Unknown', txs: [] };
        byStation[key].txs.push(tx);
    });

    for (const [stationId, data] of Object.entries(byStation)) {
        const liters = data.txs.filter(t => !t.deletedAt).reduce((sum, t) => sum + parseFloat(t.liters), 0);
        console.log(`${stationId} (${data.name}): ${data.txs.length} transactions, ${liters.toFixed(2)} liters`);
    }

    console.log('\n=== Summary ===');
    console.log(`Total transactions: ${txs.length}`);
    console.log(`Total liters: ${txs.filter(t => !t.deletedAt).reduce((sum, t) => sum + parseFloat(t.liters), 0).toFixed(2)}`);
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
