import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1';
    const startDate = new Date('2025-11-30T17:00:00.000Z');

    const owners = await prisma.owner.findMany({
        where: { name: { contains: 'โจ' } }
    });

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
        orderBy: { createdAt: 'asc' }
    });

    const byDate: Record<string, number> = {};
    for (const t of txs) {
        // Adjust for UTC+7 (Thai Time)
        const locDate = new Date(t.createdAt.getTime() + 7 * 60 * 60 * 1000);
        // Sometimes the date field in Transaction is already Thai time, check 'createdAt' vs 'date'
        // 'createdAt' is UTC. So UTC+7 is correct.
        const dStr = locDate.toISOString().split('T')[0];
        if (!byDate[dStr]) byDate[dStr] = 0;
        byDate[dStr] += Number(t.liters);
    }

    fs.writeFileSync('/tmp/jo_tank.json', JSON.stringify(byDate, null, 2));
    console.log("Exported jo_tank.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
