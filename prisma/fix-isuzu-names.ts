import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// รวมชื่อ "อีซูซุเสนียนต์" ทั้งหมดให้เป็น "บจก.อีซูซุเสนียนต์นครสวรรค์"
const OLD_NAMES = [
    'บ.อีซูซุเสนียนต์',
    'บจก. อีซูซุเสนียนต์',
    'บจก.อีซูซุเสนียนต์',
    'อีซูซุเสนียนต์',
    'อีซูซุ เสนียนต์',
    'อีซูซุ น.ว',
    'อีซูซุ นว',
];

const NEW_NAME = 'บจก.อีซูซุเสนียนต์นครสวรรค์';

async function main() {
    console.log('🔄 กำลังอัปเดตชื่อลูกค้า อีซูซุเสนียนต์...\n');

    // Update Transactions
    for (const oldName of OLD_NAMES) {
        const result = await prisma.transaction.updateMany({
            where: { ownerName: oldName },
            data: { ownerName: NEW_NAME },
        });

        if (result.count > 0) {
            console.log(`✅ Transaction: เปลี่ยน "${oldName}" -> "${NEW_NAME}" (${result.count} รายการ)`);
        }
    }

    // Update Vehicles
    for (const oldName of OLD_NAMES) {
        const result = await prisma.vehicle.updateMany({
            where: { ownerName: oldName },
            data: { ownerName: NEW_NAME },
        });

        if (result.count > 0) {
            console.log(`✅ Vehicle: เปลี่ยน "${oldName}" -> "${NEW_NAME}" (${result.count} รายการ)`);
        }
    }

    // Show summary of all Isuzu-related names in database
    console.log('\n📊 สรุปชื่อที่มี "อีซูซุ":');

    const isuzuTransactions = await prisma.transaction.groupBy({
        by: ['ownerName'],
        where: {
            ownerName: {
                contains: 'อีซูซุ',
            },
        },
        _count: {
            ownerName: true,
        },
    });

    for (const item of isuzuTransactions) {
        console.log(`  - ${item.ownerName}: ${item._count.ownerName} รายการ`);
    }

    console.log('\n✅ เสร็จสิ้น!');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
