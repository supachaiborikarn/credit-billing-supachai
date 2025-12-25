const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Confirmed mappings from user
const CONFIRMED_MAPPINGS: Record<string, string> = {
    'เจ้เงาะ': 'เอ็มเคทีคอนสตรัคชั่น',
};

async function checkAndFixRemaining() {
    console.log('=== ตรวจสอบและแก้ไข transactions ที่เหลือ ===\n');

    // 1. หา transactions ที่ยังขาด ownerId
    const transactionsWithoutOwnerId = await prisma.transaction.findMany({
        where: {
            ownerName: { not: null },
            ownerId: null,
            deletedAt: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        orderBy: { date: 'desc' },
        select: {
            id: true,
            date: true,
            ownerName: true,
            paymentType: true,
            amount: true
        }
    });

    console.log(`🔍 พบ ${transactionsWithoutOwnerId.length} transactions ที่ขาด ownerId\n`);

    if (transactionsWithoutOwnerId.length === 0) {
        console.log('✅ ไม่มี transactions ที่ต้องแก้ไข');
        await prisma.$disconnect();
        return;
    }

    // Get all owners
    const allOwners = await prisma.owner.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
    });

    // Group by ownerName
    const groupedByOwner: Record<string, any[]> = {};
    transactionsWithoutOwnerId.forEach((t: any) => {
        const name = t.ownerName || 'Unknown';
        if (!groupedByOwner[name]) {
            groupedByOwner[name] = [];
        }
        groupedByOwner[name].push(t);
    });

    console.log('📊 รายการที่ต้องตรวจสอบ:\n');

    const ownerNames = Object.keys(groupedByOwner).sort();
    let fixedCount = 0;

    for (const ownerName of ownerNames) {
        const txns = groupedByOwner[ownerName];
        const total = txns.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        console.log(`\n🔹 "${ownerName}" - ${txns.length} รายการ (${total.toLocaleString()} บาท)`);

        // Check confirmed mapping first
        const mappedName = CONFIRMED_MAPPINGS[ownerName];
        let matchedOwner = null;

        if (mappedName) {
            matchedOwner = allOwners.find((o: any) => o.name === mappedName);
            if (matchedOwner) {
                console.log(`   ✅ ตรงกับ (confirmed): ${matchedOwner.name}`);
            }
        }

        // If no mapping, search for similar owners
        if (!matchedOwner) {
            // Find similar owners by partial match
            const cleanName = ownerName
                .replace(/^(บจก\.|บริษัท|นาย|นาง|นางสาว|ห้าง|ร\.พ\s*|รร\.|พี่|เจ๊|น\.ส\.)/, '')
                .replace(/\s+/g, '')
                .trim();

            const similarOwners = allOwners.filter((o: any) => {
                const cleanOwnerName = o.name
                    .replace(/^(บจก\.|บริษัท|นาย|นาง|นางสาว|ห้าง|ร\.พ\s*|รร\.|บ\.|หจก\.|น\.ส\.)/, '')
                    .replace(/\s+/g, '')
                    .trim();

                return cleanOwnerName.includes(cleanName) ||
                    cleanName.includes(cleanOwnerName) ||
                    (cleanName.length > 2 && cleanOwnerName.includes(cleanName.substring(0, 3)));
            }).slice(0, 5);

            if (similarOwners.length > 0) {
                console.log(`   🔎 Owners ที่คล้าย:`);
                similarOwners.forEach((o: any, i: number) => {
                    console.log(`      ${i + 1}. ${o.name} (${o.id.slice(0, 8)}...)`);
                });
            } else {
                console.log(`   ❌ ไม่พบ owner ที่คล้าย`);
            }
        }

        // Apply confirmed mapping
        if (matchedOwner) {
            const result = await prisma.transaction.updateMany({
                where: {
                    ownerName: ownerName,
                    ownerId: null,
                    deletedAt: null
                },
                data: {
                    ownerId: matchedOwner.id
                }
            });
            console.log(`   📝 อัปเดต ${result.count} รายการ`);
            fixedCount += result.count;
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`📊 อัปเดตสำเร็จ ${fixedCount} รายการ`);

    // Show remaining
    const remaining = await prisma.transaction.count({
        where: {
            ownerName: { not: null },
            ownerId: null,
            deletedAt: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        }
    });
    console.log(`📈 ยังเหลือ ${remaining} รายการที่ไม่มี ownerId`);

    await prisma.$disconnect();
}

checkAndFixRemaining().catch(console.error);
