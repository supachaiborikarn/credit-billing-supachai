import { prisma } from '../src/lib/prisma';
import { STATIONS } from '../src/constants';

// Script to migrate old gas history records to correct station ID
// Handles duplicates by merging records
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

    // Find all daily records with correct stationId first (these are the target records)
    const correctRecords = await prisma.dailyRecord.findMany({
        where: { stationId: correctStation.id },
        include: { meters: true, shifts: true }
    });

    console.log(`\nFound ${correctRecords.length} records with correct station ID`);
    const correctDates = new Set(correctRecords.map(r => r.date.toISOString().split('T')[0]));

    // Find all daily records with wrong stationIds
    const wrongRecords = await prisma.dailyRecord.findMany({
        where: { stationId: { not: correctStation.id } },
        include: { meters: true, shifts: true, transactions: true }
    });

    if (wrongRecords.length === 0) {
        console.log('No records to migrate. All records have correct station ID.');
        return;
    }

    console.log(`Found ${wrongRecords.length} records with wrong station ID:`);

    let updated = 0;
    let deleted = 0;

    for (const record of wrongRecords) {
        const dateStr = record.date.toISOString().split('T')[0];
        console.log(`\nProcessing: ${dateStr}, stationId=${record.stationId}`);

        if (correctDates.has(dateStr)) {
            // A record with correct stationId already exists for this date
            // Delete the wrong record (after moving any transactions)
            console.log(`  ⚠️ Duplicate date - correct record exists, will delete wrong record`);

            // Move transactions to correct record
            const correctRecord = correctRecords.find(r =>
                r.date.toISOString().split('T')[0] === dateStr
            );

            if (correctRecord && record.transactions.length > 0) {
                await prisma.transaction.updateMany({
                    where: { dailyRecordId: record.id },
                    data: { dailyRecordId: correctRecord.id }
                });
                console.log(`  ✅ Moved ${record.transactions.length} transactions`);
            }

            // Delete meters for wrong record
            await prisma.meterReading.deleteMany({
                where: { dailyRecordId: record.id }
            });

            // Delete shifts for wrong record
            for (const shift of record.shifts) {
                await prisma.shiftMeterReading.deleteMany({
                    where: { shiftId: shift.id }
                });
            }
            await prisma.shift.deleteMany({
                where: { dailyRecordId: record.id }
            });

            // Delete the wrong daily record
            await prisma.dailyRecord.delete({
                where: { id: record.id }
            });

            deleted++;
            console.log(`  ✅ Deleted duplicate record`);
        } else {
            // No conflict, safe to update stationId
            await prisma.dailyRecord.update({
                where: { id: record.id },
                data: { stationId: correctStation.id }
            });
            correctDates.add(dateStr); // Add to set to track
            updated++;
            console.log(`  ✅ Updated stationId`);
        }
    }

    console.log(`\n✅ Migration complete.`);
    console.log(`   Updated: ${updated} records`);
    console.log(`   Deleted (duplicates): ${deleted} records`);
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
