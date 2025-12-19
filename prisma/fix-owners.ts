const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOwners() {
    // 1. Find เจ๊เงาะ and เอ็มเคที owners
    const owners = await prisma.owner.findMany({
        where: {
            OR: [
                { name: { contains: 'เงาะ' } },
                { name: { contains: 'เอ็มเคที' } },
                { name: { contains: 'MKT' } }
            ]
        },
        select: { id: true, name: true, _count: { select: { trucks: true, transactions: true } } }
    });

    console.log('Owners found:');
    console.log(JSON.stringify(owners, null, 2));

    // Find เจ๊เงาะ and เอ็มเคที
    const jeNgoh = owners.find((o: { name: string }) => o.name.includes('เงาะ'));
    const mkt = owners.find((o: { name: string }) => o.name.includes('เอ็มเคที'));

    if (jeNgoh && mkt) {
        console.log('\nMerging:', jeNgoh.name, '->', mkt.name);

        // Move transactions
        const txResult = await prisma.transaction.updateMany({
            where: { ownerId: jeNgoh.id },
            data: { ownerId: mkt.id, ownerName: mkt.name }
        });
        console.log('Transactions moved:', txResult.count);

        // Move trucks
        const truckResult = await prisma.truck.updateMany({
            where: { ownerId: jeNgoh.id },
            data: { ownerId: mkt.id }
        });
        console.log('Trucks moved:', truckResult.count);

        // Delete old owner
        await prisma.owner.delete({ where: { id: jeNgoh.id } });
        console.log('Deleted:', jeNgoh.name);
    } else {
        console.log('Could not find both owners');
    }

    // 2. Check plates without owner
    console.log('\n--- Checking plates without owner name ---');
    const plates = ['บธ4', '70-1541', 'ผต2251'];
    for (const searchPlate of plates) {
        const normalized = searchPlate.replace('-', '');

        // Find in trucks
        const truck = await prisma.truck.findFirst({
            where: { licensePlate: { contains: normalized } },
            select: { licensePlate: true, owner: { select: { name: true } } }
        });

        // Find in transactions to see who used this plate
        const tx = await prisma.transaction.findFirst({
            where: {
                licensePlate: { contains: normalized },
                ownerName: { not: null }
            },
            select: { licensePlate: true, ownerName: true, owner: { select: { name: true } } },
            orderBy: { date: 'desc' }
        });

        console.log(`${searchPlate}:`);
        console.log(`  Truck: ${truck ? truck.licensePlate + ' = ' + (truck.owner?.name || 'NO OWNER') : 'NOT FOUND'}`);
        console.log(`  Last Tx: ${tx ? tx.licensePlate + ' = ' + (tx.owner?.name || tx.ownerName) : 'NOT FOUND'}`);
    }

    await prisma.$disconnect();
}

fixOwners();
