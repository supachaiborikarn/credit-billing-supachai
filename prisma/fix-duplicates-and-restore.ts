const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDuplicatesAndRestore() {
    console.log('=== FIX DUPLICATES AND RESTORE ===\n');

    // Step 1: Find all duplicate owner names
    const owners = await prisma.owner.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, groupType: true, deletedAt: true }
    });

    // Group by normalized name (trim + lowercase)
    const nameMap = new Map<string, typeof owners>();
    for (const owner of owners) {
        const key = owner.name.trim().toLowerCase();
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key)!.push(owner);
    }

    // Find duplicates
    const duplicates = Array.from(nameMap.entries())
        .filter(([_, items]) => items.length > 1)
        .map(([_, items]) => items);

    console.log(`Found ${duplicates.length} duplicate name groups\n`);

    let mergedCount = 0;
    let deletedCount = 0;

    for (const group of duplicates) {
        // Keep the one with a code, or the first one
        const sorted = group.sort((a, b) => {
            // Prefer ones with code
            if (a.code && !b.code) return -1;
            if (!a.code && b.code) return 1;
            // Prefer SUGAR_FACTORY groupType
            if (a.groupType === 'SUGAR_FACTORY' && b.groupType !== 'SUGAR_FACTORY') return -1;
            if (a.groupType !== 'SUGAR_FACTORY' && b.groupType === 'SUGAR_FACTORY') return 1;
            return 0;
        });

        const primary = sorted[0];
        const duplicatesToMerge = sorted.slice(1);

        console.log(`\nMerging: "${primary.name}"`);
        console.log(`  Primary: ${primary.id.slice(0, 8)} (code: ${primary.code})`);

        for (const dup of duplicatesToMerge) {
            console.log(`  Merging ${dup.id.slice(0, 8)} (code: ${dup.code}) -> ${primary.id.slice(0, 8)}`);

            // Move all transactions to primary owner
            const txResult = await prisma.transaction.updateMany({
                where: { ownerId: dup.id },
                data: { ownerId: primary.id }
            });
            console.log(`    Moved ${txResult.count} transactions`);

            // Move all trucks to primary owner
            const truckResult = await prisma.truck.updateMany({
                where: { ownerId: dup.id },
                data: { ownerId: primary.id }
            });
            console.log(`    Moved ${truckResult.count} trucks`);

            // Delete the duplicate owner
            await prisma.owner.delete({ where: { id: dup.id } });
            deletedCount++;
            console.log(`    Deleted duplicate`);
            mergedCount++;
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Merged ${mergedCount} duplicate entries`);
    console.log(`Deleted ${deletedCount} duplicate owners`);

    // Step 2: Check remaining owners
    const finalCount = await prisma.owner.count();
    console.log(`\nFinal owner count: ${finalCount}`);

    // Step 3: Check อารยะวงศ์ specifically
    const arayaOwners = await prisma.owner.findMany({
        where: { name: { contains: 'อารยะ' } },
        select: { id: true, name: true, code: true }
    });
    console.log('\nอารยะวงศ์ after fix:');
    arayaOwners.forEach(o => console.log(`  ${o.name} - code: ${o.code}`));

    await prisma.$disconnect();
}

fixDuplicatesAndRestore().catch(console.error);
