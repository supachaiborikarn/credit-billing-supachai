import { prisma } from '../src/lib/prisma';
import { STATIONS } from '../src/constants';

// Script to migrate old gas history records to correct station ID
async function migrateGasHistoryStationIds() {
    console.log('Starting gas history station ID migration...\n');

    // Get the correct database station for ปั๊มแก๊สพงษ์อนันต์ (station-5)
    const gasStationConfig = STATIONS.find(s => s.id === 'station-5');
    if (!gasStationConfig) {
        console.error('Station config not found for station-5');
        return;
    }

    console.log(`Looking for station: ${gasStationConfig.name}`);

    // Find or create the correct station
    let correctStation = await prisma.station.findFirst({
        where: { name: gasStationConfig.name }
    });

    if (!correctStation) {
        correctStation = await prisma.station.create({
            data: {
                name: gasStationConfig.name,
                type: 'GAS',
                gasPrice: 16.09,
                gasStockAlert: 1000,
            }
        });
        console.log(`Created station: ${correctStation.id}`);
    } else {
        console.log(`Found station: ${correctStation.id}`);
    }

    // Find all daily records with wrong stationIds
    const allRecords = await prisma.dailyRecord.findMany({
        include: { station: true }
    });

    console.log(`\nFound ${allRecords.length} daily records total`);

    // Filter records that are NOT linked to the correct station
    const wrongRecords = allRecords.filter(r => r.stationId !== correctStation!.id);

    if (wrongRecords.length === 0) {
        console.log('No records to migrate. All records have correct station ID.');
        return;
    }

    console.log(`Found ${wrongRecords.length} records with wrong station ID:`);
    wrongRecords.forEach(r => {
        console.log(`  - ${r.date.toISOString().split('T')[0]}: stationId=${r.stationId}`);
    });

    // Update records to use correct station ID
    console.log('\nMigrating records...');
    let updated = 0;
    for (const record of wrongRecords) {
        await prisma.dailyRecord.update({
            where: { id: record.id },
            data: { stationId: correctStation.id }
        });
        updated++;
        console.log(`  Updated: ${record.date.toISOString().split('T')[0]}`);
    }

    console.log(`\n✅ Migration complete. Updated ${updated} records.`);

    // Also update transactions that might have wrong stationId
    const transactions = await prisma.transaction.findMany({
        where: {
            stationId: { not: correctStation.id },
            // Only gas station transactions (LPG)
            productType: 'LPG'
        }
    });

    if (transactions.length > 0) {
        console.log(`\nFound ${transactions.length} transactions to migrate...`);
        await prisma.transaction.updateMany({
            where: {
                stationId: { not: correctStation.id },
                productType: 'LPG'
            },
            data: { stationId: correctStation.id }
        });
        console.log(`✅ Updated ${transactions.length} transactions.`);
    }

    // Update gas supplies
    const supplies = await prisma.gasSupply.findMany({
        where: {
            stationId: { not: correctStation.id }
        }
    });

    if (supplies.length > 0) {
        console.log(`\nFound ${supplies.length} gas supplies to migrate...`);
        await prisma.gasSupply.updateMany({
            where: { stationId: { not: correctStation.id } },
            data: { stationId: correctStation.id }
        });
        console.log(`✅ Updated ${supplies.length} gas supplies.`);
    }
}

migrateGasHistoryStationIds()
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
