import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const dates = [
        new Date('2026-02-04T00:00:00.000Z'),
        new Date('2026-02-05T00:00:00.000Z'),
        new Date('2026-02-06T00:00:00.000Z'),
        new Date('2026-02-07T00:00:00.000Z'),
        new Date('2026-02-08T00:00:00.000Z'),
        new Date('2026-02-12T00:00:00.000Z'),
        new Date('2026-02-13T00:00:00.000Z'),
        new Date('2026-02-14T00:00:00.000Z'),
        new Date('2026-02-15T00:00:00.000Z'),
        new Date('2026-02-16T00:00:00.000Z'),
        new Date('2026-02-20T00:00:00.000Z'),
        new Date('2026-02-21T00:00:00.000Z'),
        new Date('2026-02-22T00:00:00.000Z'),
        new Date('2026-02-23T00:00:00.000Z'),
        new Date('2026-02-24T00:00:00.000Z')
    ];

    const STATION_ID = 'station-1'; // แท๊งลอยวัชรเกียรติ

    for (const d of dates) {
        const next = new Date(d);
        next.setDate(next.getDate() + 1);

        console.log(`\n\n====================== Date: ${d.toISOString().split('T')[0]} ======================`);

        // 1. Check DailyRecord
        const dailyRecords = await prisma.dailyRecord.findMany({
            where: {
                stationId: STATION_ID,
                date: {
                    gte: d,
                    lt: next
                }
            },
            include: {
                shifts: true,
                meters: {
                    orderBy: { nozzleNumber: 'asc' }
                }
            }
        });

        for (const dr of dailyRecords) {
            console.log(`DailyRecord status: ${dr.status}, Shifts count: ${dr.shifts.length}`);
            for (const m of dr.meters) {
                console.log(`  Nozzle ${m.nozzleNumber}: Start=${m.startReading} | End=${m.endReading || '?'} | Sold=${m.soldQty || '?'}`);
            }
            if (dr.shifts.length > 0) {
                console.log(`  Shifts: ${JSON.stringify(dr.shifts.map(s => s.shiftNumber))}`);
            }
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
