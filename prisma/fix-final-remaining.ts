const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// All confirmed mappings based on search results
const FINAL_MAPPINGS: Record<string, string> = {
    'น้ำตาลนครเพชร': 'บ.น้ำตาลนครเพรช',  // typo in original: เพรช vs เพชร
    'บริษัทเคพีออกซิเจน': 'บจก. เค พี ออกซิเจนกรุ๊ป',
    'เคพี ออกซิเจน': 'บจก. เค พี ออกซิเจนกรุ๊ป',
    'เคพีออกซิเจน': 'บจก. เค พี ออกซิเจนกรุ๊ป',
    'ร.พ เอกชนกำแพงเพชร': 'รพ.เอกชนเมืองกำแพง',
    'โรงพยาบาลเอกชนเมืองกำแพงเพชร': 'รพ.เอกชนเมืองกำแพง',
    'เพชรคอนสตรัคชั่น': 'บจก.เพชร คอนสตรัคชั่น',
};

async function fixFinalRemaining() {
    console.log('=== แก้ไข transactions ที่เหลือทั้งหมด ===\n');

    // Get all owners
    const allOwners = await prisma.owner.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
    });

    let totalFixed = 0;

    for (const [txnOwnerName, dbOwnerName] of Object.entries(FINAL_MAPPINGS)) {
        const owner = allOwners.find((o: any) => o.name === dbOwnerName);

        if (!owner) {
            console.log(`❌ ไม่พบ "${dbOwnerName}" ในระบบ`);
            continue;
        }

        const result = await prisma.transaction.updateMany({
            where: {
                ownerName: txnOwnerName,
                ownerId: null,
                deletedAt: null
            },
            data: {
                ownerId: owner.id
            }
        });

        if (result.count > 0) {
            console.log(`✅ "${txnOwnerName}" -> "${dbOwnerName}": ${result.count} รายการ`);
            totalFixed += result.count;
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`📊 อัปเดตสำเร็จ ${totalFixed} รายการ`);

    // Show remaining
    const remaining = await prisma.transaction.findMany({
        where: {
            ownerName: { not: null },
            ownerId: null,
            deletedAt: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        select: {
            ownerName: true,
            amount: true,
            date: true

        }
    });

    console.log(`📈 ยังเหลือ ${remaining.length} รายการ:`);
    remaining.forEach((t: any) => {
        console.log(`   - ${t.date.toISOString().split('T')[0]} | ${t.ownerName} | ${t.amount} บาท`);
    });

    await prisma.$disconnect();
}

fixFinalRemaining().catch(console.error);
