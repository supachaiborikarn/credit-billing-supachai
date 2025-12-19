import { prisma } from '../src/lib/prisma';

async function fixDuplicates() {
    console.log('===== FIXING DUPLICATE OWNERS =====');

    // 1. Restore วีระวณิชย์
    const restored = await prisma.owner.updateMany({
        where: { name: { contains: 'วีระวณิชย์' } },
        data: { deletedAt: null }
    });
    console.log('Restored วีระวณิชย์:', restored.count);

    // 2. Get all active owners
    const allOwners = await prisma.owner.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' }
    });

    // Group by name
    const nameGroups = new Map<string, typeof allOwners>();
    allOwners.forEach(o => {
        const name = o.name.trim();
        if (!nameGroups.has(name)) {
            nameGroups.set(name, []);
        }
        nameGroups.get(name)!.push(o);
    });

    let mergedCount = 0;

    for (const [name, owners] of nameGroups.entries()) {
        if (owners.length > 1) {
            const keepOwner = owners[0];
            const duplicateIds = owners.slice(1).map(o => o.id);

            // Update transactions to point to the kept owner
            const updated = await prisma.transaction.updateMany({
                where: { ownerId: { in: duplicateIds } },
                data: { ownerId: keepOwner.id }
            });

            // Update trucks to point to the kept owner
            await prisma.truck.updateMany({
                where: { ownerId: { in: duplicateIds } },
                data: { ownerId: keepOwner.id }
            });

            // Soft delete duplicate owners
            await prisma.owner.updateMany({
                where: { id: { in: duplicateIds } },
                data: { deletedAt: new Date() }
            });

            console.log('Merged:', name, '| Tx:', updated.count, '| Deleted:', duplicateIds.length);
            mergedCount += duplicateIds.length;
        }
    }

    const remainingOwners = await prisma.owner.count({ where: { deletedAt: null } });

    console.log('\n===== SUMMARY =====');
    console.log('Duplicate owners merged:', mergedCount);
    console.log('Remaining active owners:', remainingOwners);

    await prisma.$disconnect();
}

fixDuplicates();
