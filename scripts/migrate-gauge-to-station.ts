import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Migrate gauge readings from UUID format to station-X format
 * 
 * Mapping:
 * d01b9c7b-fcf0-4185-a0b1-a5840391a61c -> station-5 (ปั๊มแก๊สพงษ์อนันต์)
 * 6950b69c-1841-4d22-a915-22141b94ca46 -> station-6 (ปั๊มแก๊สศุภชัย)
 */
async function migrate() {
    console.log('Starting gauge readings migration...\n');

    const mapping: Record<string, string> = {
        'd01b9c7b-fcf0-4185-a0b1-a5840391a61c': 'station-5',
        '6950b69c-1841-4d22-a915-22141b94ca46': 'station-6'
    };

    for (const [uuid, stationId] of Object.entries(mapping)) {
        // Find gauge readings with UUID
        const gauges = await prisma.gaugeReading.findMany({
            where: { stationId: uuid }
        });

        console.log(`Found ${gauges.length} gauge readings for ${uuid}`);

        if (gauges.length > 0) {
            // Update to station-X format
            const result = await prisma.gaugeReading.updateMany({
                where: { stationId: uuid },
                data: { stationId: stationId }
            });
            console.log(`  -> Migrated ${result.count} records to ${stationId}\n`);
        }
    }

    // Verify migration
    console.log('\n=== VERIFICATION ===');
    const gauges = await prisma.gaugeReading.groupBy({
        by: ['stationId'],
        _count: { id: true }
    });
    gauges.forEach(g => console.log(`  ${g.stationId}: ${g._count.id} readings`));

    await prisma.$disconnect();
    console.log('\nMigration complete!');
}

migrate().catch(console.error);
