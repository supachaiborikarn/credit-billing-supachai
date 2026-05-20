import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1';

    // Find all daily records in a month
    const records = await prisma.dailyRecord.findMany({
        where: {
            stationId: STATION_ID,
            date: {
                gte: new Date('2026-02-01T00:00:00.000Z'),
                lt: new Date('2026-02-28T00:00:00.000Z')
            }
        },
        orderBy: { date: 'asc' },
        include: {
            meters: { orderBy: { nozzleNumber: 'asc' } }
        }
    });

    for (const r of records) {
        console.log(`DB Date: ${r.date.toISOString()} -> Expects UI DateStr: ${new Date(r.date.getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0]}`);
        console.log(`  Nozzle 1: ${r.meters[0]?.startReading} -> ${r.meters[0]?.endReading}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
