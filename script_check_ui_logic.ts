import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1';

    // Test for UI Date Strings
    const dateStrs = ['2026-02-05', '2026-02-06', '2026-02-07', '2026-02-13', '2026-02-14', '2026-02-15'];

    for (const dStr of dateStrs) {
        // UI uses getStartOfDayBangkok
        const [year, month, day] = dStr.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        date.setUTCHours(date.getUTCHours() - 7);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        console.log(`\n\n=== UI Date: ${dStr} (DB date: ${date.toISOString()}) ===`);

        const dailyRecord = await prisma.dailyRecord.findUnique({
            where: { stationId_date: { stationId: STATION_ID, date } },
            include: { meters: { orderBy: { nozzleNumber: 'asc' } } }
        });

        let meterTotal = 0;
        if (dailyRecord) {
            console.log(`DailyRecord: ${dailyRecord.id}`);
            for (const m of dailyRecord.meters) {
                const diff = (m.endReading ? Number(m.endReading) : 0) - Number(m.startReading);
                meterTotal += diff;
                console.log(`  Nozzle ${m.nozzleNumber}: Start=${m.startReading} | End=${m.endReading || '?'} | Diff=${diff}`);
            }
        } else {
            console.log(`DailyRecord: Not Found`);
        }

        const txs = await prisma.transaction.findMany({
            where: {
                stationId: STATION_ID,
                createdAt: { gte: date, lt: nextDate }
            }
        });

        const txTotalLiters = txs.reduce((sum, t) => sum + Number(t.liters), 0);
        console.log(`\nMeter Total Diff: ${meterTotal.toFixed(2)} L`);
        console.log(`Transactions Total Liters: ${txTotalLiters.toFixed(2)} L (Count: ${txs.length})`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
