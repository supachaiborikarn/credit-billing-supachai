import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map of name variations to standard name
const NAME_MAPPINGS: Record<string, string> = {
    // กำแพงเพชรวีระวณิชย์ variations
    'กำแพงเพชรวีระวณิชย์.': 'กำแพงเพชรวีระวณิชย์',
    'บจก.กำแพงเพชรวีระวณิชย์': 'กำแพงเพชรวีระวณิชย์',

    // อีซูซุเสนีย์ยนต์ variations  
    'บจก.อีซูซุเสนียนต์นครสวรรค์': 'อีซูซุเสนีย์ยนต์นครสวรรค์',
    'อีซูซุเสนียนต์นครสวรรค์': 'อีซูซุเสนีย์ยนต์นครสวรรค์',
};

async function main() {
    console.log('🔧 กำลังแก้ไขชื่อซ้ำใน Transaction...\n');

    let totalUpdated = 0;

    for (const [oldName, newName] of Object.entries(NAME_MAPPINGS)) {
        // Find all transactions with the old name
        const transactions = await prisma.transaction.findMany({
            where: { ownerName: oldName }
        });

        if (transactions.length > 0) {
            console.log(`📝 "${oldName}" → "${newName}" (${transactions.length} รายการ)`);

            // Update all matching transactions
            const result = await prisma.transaction.updateMany({
                where: { ownerName: oldName },
                data: { ownerName: newName }
            });

            totalUpdated += result.count;
        }
    }

    // Also update Owner table if needed
    console.log('\n📋 ตรวจสอบตาราง Owner...');
    for (const [oldName, newName] of Object.entries(NAME_MAPPINGS)) {
        const owners = await prisma.owner.findMany({
            where: { name: oldName }
        });

        if (owners.length > 0) {
            console.log(`  Owner "${oldName}" → "${newName}"`);

            // Find the correct owner with the new name
            const correctOwner = await prisma.owner.findFirst({
                where: { name: newName }
            });

            if (correctOwner) {
                // Update trucks to point to correct owner
                for (const oldOwner of owners) {
                    await prisma.truck.updateMany({
                        where: { ownerId: oldOwner.id },
                        data: { ownerId: correctOwner.id }
                    });

                    // Update transactions to point to correct owner
                    await prisma.transaction.updateMany({
                        where: { ownerId: oldOwner.id },
                        data: { ownerId: correctOwner.id }
                    });

                    // Soft delete the old owner
                    await prisma.owner.update({
                        where: { id: oldOwner.id },
                        data: { deletedAt: new Date() }
                    });
                }
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ อัปเดต Transaction ทั้งหมด: ${totalUpdated} รายการ`);
    console.log('✅ เสร็จสิ้น!');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
