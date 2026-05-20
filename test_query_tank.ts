import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1'; // แท๊งลอยวัชรเกียรติ
    const startDate = new Date('2025-11-30T17:00:00.000Z');

    // Find owners matching 'โจ'
    const owners = await prisma.owner.findMany({
        where: { name: { contains: 'โจ' } }
    });
    console.log("Found owners matching 'โจ':", owners.map(o => ({ id: o.id, name: o.name })));

    // Find transactions for station-1 that might belong to Jo
    const txs = await prisma.transaction.findMany({
        where: {
            stationId: STATION_ID,
            createdAt: { gte: startDate },
            OR: [
                { ownerName: { contains: 'โจ' } },
                { ownerId: { in: owners.map(o => o.id) } },
                { truck: { ownerId: { in: owners.map(o => o.id) } } }
            ]
        },
        orderBy: { createdAt: 'asc' },
        include: { truck: true, owner: true }
    });

    console.log(`Found ${txs.length} transactions for โจ from แท๊งลอย since 2025-12-01`);
    
    // Group by date to easily compare with what he entered
    const byDate: Record<string, number> = {};
    for (const t of txs) {
        // use local Thai date for grouping since it's UTC in DB
        const locDate = new Date(t.createdAt.getTime() + 7 * 60 * 60 * 1000);
        const dStr = locDate.toISOString().split('T')[0];
        if (!byDate[dStr]) byDate[dStr] = 0;
        byDate[dStr] += Number(t.liters);
    }

    Object.entries(byDate).sort((a,b) => a[0].localeCompare(b[0])).forEach(([d, liters]) => {
        console.log(`Date: ${d}, from_tank: ${liters.toFixed(2)} L`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
