import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1';
    const startDate = new Date('2025-11-30T17:00:00.000Z');

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: STATION_ID,
            createdAt: { gte: startDate },
            OR: [
                { licensePlate: { contains: '8111' } },
                { truck: { licensePlate: { contains: '8111' } } },
                { truck: { code: { contains: '8111' } } }
            ]
        },
        orderBy: { createdAt: 'asc' },
        include: { truck: true }
    });

    const byDate: Record<string, number> = {};
    for (const t of txs) {
        if (Number(t.liters) < 100) continue; // Ignore < 100L per transaction as requested
        
        const locDate = new Date(t.createdAt.getTime() + 7 * 60 * 60 * 1000);
        const dStr = locDate.toISOString().split('T')[0];
        if (!byDate[dStr]) byDate[dStr] = 0;
        byDate[dStr] += Number(t.liters);
    }

    fs.writeFileSync('/tmp/jo_tank_8111.json', JSON.stringify(byDate, null, 2));
    console.log(`Exported jo_tank_8111.json with ${Object.keys(byDate).length} days of records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
