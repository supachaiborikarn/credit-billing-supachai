import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
    // Check stations
    const stations = await prisma.station.findMany({
        where: { type: 'GAS' },
        select: { id: true, name: true }
    });
    console.log('\n=== GAS STATIONS ===');
    stations.forEach(s => console.log(`  ${s.id}: ${s.name}`));

    // Check DailyRecords per stationId
    const dailyRecords = await prisma.dailyRecord.groupBy({
        by: ['stationId'],
        _count: { id: true }
    });
    console.log('\n=== DAILY RECORDS BY STATION ===');
    dailyRecords.forEach(d => console.log(`  ${d.stationId}: ${d._count.id} records`));

    // Check Shifts by stationId (through dailyRecord)
    const shiftsWithStation = await prisma.shift.findMany({
        select: {
            dailyRecord: {
                select: { stationId: true }
            }
        }
    });
    const shiftCounts: Record<string, number> = {};
    shiftsWithStation.forEach(s => {
        const sid = s.dailyRecord.stationId;
        shiftCounts[sid] = (shiftCounts[sid] || 0) + 1;
    });
    console.log('\n=== SHIFTS BY STATION ===');
    Object.entries(shiftCounts).forEach(([k, v]) => console.log(`  ${k}: ${v} shifts`));

    // Check Transactions per stationId
    const txns = await prisma.transaction.groupBy({
        by: ['stationId'],
        _count: { id: true }
    });
    console.log('\n=== TRANSACTIONS BY STATION ===');
    txns.forEach(t => console.log(`  ${t.stationId}: ${t._count.id} transactions`));

    // Check GaugeReadings
    const gauges = await prisma.gaugeReading.groupBy({
        by: ['stationId'],
        _count: { id: true }
    });
    console.log('\n=== GAUGE READINGS BY STATION ===');
    gauges.forEach(g => console.log(`  ${g.stationId}: ${g._count.id} readings`));

    // Check MeterReadings
    const meters = await prisma.meterReading.count();
    console.log(`\n=== TOTAL METER READINGS: ${meters} ===`);

    await prisma.$disconnect();
}
audit().catch(console.error);
