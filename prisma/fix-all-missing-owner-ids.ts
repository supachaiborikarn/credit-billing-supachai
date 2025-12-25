const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllMissingOwnerIds() {
    console.log('=== ตรวจสอบและแก้ไข transactions ที่ขาด ownerId ทั้งหมด ===\n');

    // 1. หา transactions ที่มี ownerName แต่ไม่มี ownerId
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

    // 2. จัดกลุ่มตาม ownerName
    const groupedByOwner: Record<string, any[]> = {};
    transactionsWithoutOwnerId.forEach((t: any) => {
        const name = t.ownerName || 'Unknown';
        if (!groupedByOwner[name]) {
            groupedByOwner[name] = [];
        }
        groupedByOwner[name].push(t);
    });

    console.log('📊 สรุปตามเจ้าของ:');
    console.log('─'.repeat(80));

    const ownerNames = Object.keys(groupedByOwner).sort();
    ownerNames.forEach((name, i) => {
        const txns = groupedByOwner[name];
        const total = txns.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        console.log(`${i + 1}. ${name.padEnd(25)} | ${txns.length.toString().padStart(3)} รายการ | ${total.toLocaleString().padStart(15)} บาท`);
    });

    // 3. หา owners ทั้งหมดจาก database
    const allOwners = await prisma.owner.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
    });

    console.log(`\n📋 มี owners ในระบบทั้งหมด ${allOwners.length} ราย\n`);

    // 4. Match และ update
    let fixedCount = 0;
    let notFoundCount = 0;
    const notFoundOwners: string[] = [];

    console.log('🔧 กำลังแก้ไข...\n');

    for (const ownerName of ownerNames) {
        // หา owner ที่ตรงกัน
        const matchedOwner = allOwners.find((o: any) =>
            o.name === ownerName ||
            o.name.includes(ownerName) ||
            ownerName.includes(o.name)
        );

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

            console.log(`✅ ${ownerName}: อัปเดต ${result.count} รายการ -> ${matchedOwner.name} (${matchedOwner.id.slice(0, 8)}...)`);
            fixedCount += result.count;
        } else {
            console.log(`❌ ${ownerName}: ไม่พบ owner ในระบบ (${groupedByOwner[ownerName].length} รายการ)`);
            notFoundCount += groupedByOwner[ownerName].length;
            notFoundOwners.push(ownerName);
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`📊 สรุปผล:`);
    console.log(`   ✅ แก้ไขสำเร็จ: ${fixedCount} รายการ`);
    console.log(`   ❌ ไม่พบ owner: ${notFoundCount} รายการ`);

    if (notFoundOwners.length > 0) {
        console.log(`\n⚠️ ต้องสร้าง owner ใหม่หรือ merge สำหรับ:`);
        notFoundOwners.forEach(name => console.log(`   - ${name}`));
    }

    // 5. ตรวจสอบสถานะสุดท้าย
    const remainingWithoutOwnerId = await prisma.transaction.count({
        where: {
            ownerName: { not: null },
            ownerId: null,
            deletedAt: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        }
    });

    console.log(`\n📈 Transactions ที่ยังขาด ownerId: ${remainingWithoutOwnerId} รายการ`);

    await prisma.$disconnect();
}

fixAllMissingOwnerIds().catch(console.error);
