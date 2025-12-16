// Script to fix BOX_TRUCK data
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/fix-box-trucks.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Correct BOX_TRUCK data - เจ้าของรถตู้ทึบ 7 คน
const BOX_TRUCK_DATA = [
    { plate: '7879', ownerName: 'ตึ๋ง', phone: '093-1410300' },
    { plate: '7888', ownerName: 'แสบ', phone: '080-2765944' },
    { plate: '7999', ownerName: 'แถม', phone: '065-2522652' },
    { plate: '8111', ownerName: 'โจ', phone: '094-6305006' },
    { plate: '8222', ownerName: 'สมาน', phone: '092-8946369' },
    { plate: '4486', ownerName: 'ไผ่', phone: '096-6673195' },
    { plate: '9153', ownerName: 'เอ็ม', phone: '093-7607161' },
];

// Plate variations to merge (same truck, different formats)
const PLATE_VARIATIONS: Record<string, string[]> = {
    '7879': ['7879', 'บพ-7879'],
    '7888': ['7888'],
    '7999': ['7999', 'บพ-7999'],
    '8111': ['8111', 'บพ-8111'],
    '8222': ['8222', 'บพ-8222'],
    '4486': ['4486', 'ผค-4486'],
    '9153': ['9153', 'บว-9153', 'บว 9153'],
};

async function main() {
    console.log('🔧 Fixing BOX_TRUCK data...\n');

    for (const { plate, ownerName, phone } of BOX_TRUCK_DATA) {
        console.log(`\n--- Processing: ${plate} -> ${ownerName} ---`);

        // 1. Find or create the correct owner
        let owner = await prisma.owner.findFirst({
            where: {
                name: ownerName,
                groupType: 'BOX_TRUCK'
            }
        });

        if (!owner) {
            // Check if exists with different group
            owner = await prisma.owner.findFirst({
                where: { name: ownerName }
            });

            if (owner) {
                // Update to BOX_TRUCK
                owner = await prisma.owner.update({
                    where: { id: owner.id },
                    data: {
                        groupType: 'BOX_TRUCK',
                        phone: phone || owner.phone
                    }
                });
                console.log(`✅ Updated owner: ${ownerName} -> BOX_TRUCK`);
            } else {
                // Create new
                owner = await prisma.owner.create({
                    data: {
                        name: ownerName,
                        phone: phone,
                        groupType: 'BOX_TRUCK',
                    }
                });
                console.log(`✅ Created owner: ${ownerName}`);
            }
        } else {
            // Update phone if missing
            if (!owner.phone && phone) {
                await prisma.owner.update({
                    where: { id: owner.id },
                    data: { phone }
                });
            }
            console.log(`⏭️  Owner exists: ${ownerName}`);
        }

        // 2. Handle all plate variations
        const variations = PLATE_VARIATIONS[plate] || [plate];

        for (const plateVar of variations) {
            // Find trucks with this plate variation
            const trucks = await prisma.truck.findMany({
                where: {
                    licensePlate: { contains: plateVar, mode: 'insensitive' }
                }
            });

            for (const truck of trucks) {
                if (truck.ownerId !== owner.id) {
                    // Update truck to correct owner
                    await prisma.truck.update({
                        where: { id: truck.id },
                        data: { ownerId: owner.id }
                    });
                    console.log(`  📦 Moved truck ${truck.licensePlate} to ${ownerName}`);
                }
            }

            // Update transactions with this plate
            const updatedTx = await prisma.transaction.updateMany({
                where: {
                    OR: [
                        { licensePlate: { contains: plateVar, mode: 'insensitive' } },
                    ]
                },
                data: {
                    ownerId: owner.id,
                    ownerName: ownerName,
                }
            });

            if (updatedTx.count > 0) {
                console.log(`  📝 Updated ${updatedTx.count} transactions for plate ${plateVar}`);
            }
        }

        // 3. Create truck if not exists
        const mainTruck = await prisma.truck.findFirst({
            where: {
                licensePlate: plate,
                ownerId: owner.id
            }
        });

        if (!mainTruck) {
            await prisma.truck.create({
                data: {
                    licensePlate: plate,
                    ownerId: owner.id,
                }
            });
            console.log(`  🚚 Created truck: ${plate}`);
        }
    }

    // 4. Clean up - delete duplicate owners without transactions
    console.log('\n🧹 Cleaning up...');

    // Find BOX_TRUCK owners not in our list
    const correctNames = BOX_TRUCK_DATA.map(d => d.ownerName);
    const oldOwners = await prisma.owner.findMany({
        where: {
            groupType: 'BOX_TRUCK',
            name: { notIn: correctNames }
        },
        include: {
            transactions: { take: 1 },
            trucks: { take: 1 }
        }
    });

    for (const oldOwner of oldOwners) {
        if (oldOwner.transactions.length === 0 && oldOwner.trucks.length === 0) {
            await prisma.owner.delete({ where: { id: oldOwner.id } });
            console.log(`🗑️  Deleted unused owner: ${oldOwner.name}`);
        } else {
            console.log(`⚠️  Kept owner ${oldOwner.name} (has ${oldOwner.transactions.length} tx, ${oldOwner.trucks.length} trucks)`);
        }
    }

    console.log('\n✨ Done!');

    // Summary
    const finalOwners = await prisma.owner.findMany({
        where: { groupType: 'BOX_TRUCK' },
        include: { trucks: true, _count: { select: { transactions: true } } }
    });

    console.log('\n📊 Final BOX_TRUCK Summary:');
    finalOwners.forEach(o => {
        console.log(`  ${o.name} (${o.phone || 'no phone'}) - ${o.trucks.length} trucks, ${o._count.transactions} transactions`);
    });
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
