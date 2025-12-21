import { prisma } from '../src/lib/prisma';
import { STATIONS } from '../src/constants';

// Script to fix incorrectly migrated station data
// Records with BOX_TRUCK, DIESEL transactions should go back to station-1 (แท๊งลอยวัชรเกียรติ)
// Records with LPG/gas transactions should stay at station-5 (ปั๊มแก๊สพงษ์อนันต์)
async function fixMigratedData() {
    console.log('Starting fix for incorrectly migrated data...\n');

    // Get station configs
    const tankLoyConfig = STATIONS.find(s => s.id === 'station-1');
    const gasStationConfig = STATIONS.find(s => s.id === 'station-5');

    if (!tankLoyConfig || !gasStationConfig) {
        console.error('Station configs not found');
        return;
    }

    console.log(`Tank Loy: ${tankLoyConfig.name}`);
    console.log(`Gas Station: ${gasStationConfig.name}`);

    // Find or create the stations
    let tankLoyStation = await prisma.station.findFirst({
        where: { name: tankLoyConfig.name }
    });

    if (!tankLoyStation) {
        tankLoyStation = await prisma.station.create({
            data: {
                name: tankLoyConfig.name,
                type: 'FUEL',
                gasPrice: 31.34,
            }
        });
        console.log(`Created Tank Loy station: ${tankLoyStation.id}`);
    } else {
        console.log(`Found Tank Loy station: ${tankLoyStation.id}`);
    }

    const gasStation = await prisma.station.findFirst({
        where: { name: gasStationConfig.name }
    });

    if (!gasStation) {
        console.error('Gas station not found!');
        return;
    }
    console.log(`Found Gas station: ${gasStation.id}`);

    // Find all daily records currently at gas station
    const allRecords = await prisma.dailyRecord.findMany({
        where: { stationId: gasStation.id },
        include: {
            transactions: {
                select: { id: true, productType: true, paymentType: true }
            },
            meters: true
        }
    });

    console.log(`\nFound ${allRecords.length} records at gas station`);

    // Identify records that belong to Tank Loy based on:
    // 1. Has transactions with productType like DIESEL, GASOHOL, etc.
    // 2. Has transactions with paymentType like BOX_TRUCK, OIL_TRUCK_SUPACHAI
    // 3. Has high meter readings (5+ million - unlikely for LPG)

    const tankLoyRecords: typeof allRecords = [];
    const gasStationRecords: typeof allRecords = [];

    for (const record of allRecords) {
        const hasFuelTransactions = record.transactions.some(t =>
            t.productType && ['DIESEL', 'GASOHOL_95', 'GASOHOL_91', 'GASOHOL_E20', 'BENZIN_95', 'POWER_DIESEL'].includes(t.productType)
        );

        const hasTankLoyPayments = record.transactions.some(t =>
            ['BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'].includes(t.paymentType)
        );

        const hasHighMeterReadings = record.meters.some(m =>
            Number(m.startReading) > 1000000 || Number(m.endReading || 0) > 1000000
        );

        if (hasFuelTransactions || hasTankLoyPayments || hasHighMeterReadings) {
            tankLoyRecords.push(record);
        } else {
            gasStationRecords.push(record);
        }
    }

    console.log(`\nClassification result:`);
    console.log(`- Tank Loy records: ${tankLoyRecords.length}`);
    console.log(`- Gas Station records: ${gasStationRecords.length}`);

    if (tankLoyRecords.length === 0) {
        console.log('\nNo Tank Loy records to move.');
        return;
    }

    console.log('\nRecords to move to Tank Loy:');
    tankLoyRecords.forEach(r => {
        const dateStr = r.date.toISOString().split('T')[0];
        const txCount = r.transactions.length;
        const types = [...new Set(r.transactions.map(t => t.paymentType))].join(', ');
        console.log(`  - ${dateStr}: ${txCount} transactions (${types})`);
    });

    console.log('\n⚠️ Moving records to Tank Loy...');

    // Check for conflicts first
    const existingTankLoyRecords = await prisma.dailyRecord.findMany({
        where: { stationId: tankLoyStation.id }
    });
    const existingDates = new Set(
        existingTankLoyRecords.map(r => r.date.toISOString().split('T')[0])
    );

    let moved = 0;
    let conflicted = 0;

    for (const record of tankLoyRecords) {
        const dateStr = record.date.toISOString().split('T')[0];

        if (existingDates.has(dateStr)) {
            console.log(`  ⚠️ Conflict: ${dateStr} already exists at Tank Loy, skipping`);
            conflicted++;
            continue;
        }

        await prisma.dailyRecord.update({
            where: { id: record.id },
            data: { stationId: tankLoyStation.id }
        });
        moved++;
        console.log(`  ✅ Moved: ${dateStr}`);
    }

    console.log(`\n✅ Fix complete.`);
    console.log(`   Moved: ${moved} records`);
    console.log(`   Skipped (conflicts): ${conflicted} records`);
}

fixMigratedData()
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
