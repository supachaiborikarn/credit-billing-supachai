import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkTransactionsToOwners() {
    console.log('🔗 Linking transactions to owners...');

    // Get all trucks with their owners
    const allTrucks = await prisma.truck.findMany({
        include: { owner: true }
    });

    // Filter trucks that have owners
    const trucks = allTrucks.filter(t => t.owner !== null);
    const truckMap = new Map(trucks.map(t => [t.licensePlate, t]));

    console.log(`📋 Found ${trucks.length} trucks with owners`);

    // Get transactions without owner link
    const transactions = await prisma.transaction.findMany({
        where: { ownerId: null }
    });

    console.log(`📋 Found ${transactions.length} transactions to update`);

    let updated = 0;
    let skipped = 0;

    for (const txn of transactions) {
        const licensePlate = txn.licensePlate;
        if (!licensePlate || licensePlate === 'รถนอก') {
            skipped++;
            continue;
        }

        // Try exact match first
        let truck = truckMap.get(licensePlate);

        // Try partial match (license plate might be part of a pair like "กพ80-4332/กพ83-2193")
        if (!truck) {
            for (const [plate, t] of truckMap) {
                if (plate.includes(licensePlate) || licensePlate.includes(plate.split('/')[0])) {
                    truck = t;
                    break;
                }
            }
        }

        if (truck && truck.owner) {
            try {
                await prisma.transaction.update({
                    where: { id: txn.id },
                    data: {
                        ownerId: truck.owner.id,
                        ownerName: truck.owner.name,
                        truckId: truck.id,
                    }
                });
                updated++;
            } catch (error) {
                console.error(`Error updating txn ${txn.id}:`, error);
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    console.log(`✅ Updated ${updated} transactions`);
    console.log(`⚠️ Skipped ${skipped} transactions (no matching truck/owner)`);

    // Summary
    const linkedCount = await prisma.transaction.count({ where: { ownerId: { not: null } } });
    const totalCount = await prisma.transaction.count();
    console.log(`\n📊 ${linkedCount}/${totalCount} transactions now have owner links`);
}

linkTransactionsToOwners()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
