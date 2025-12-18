import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 แก้ไข ownerId ที่หายไปทั้งหมด...\n');

    // 1. หา transactions ที่มี ownerName แต่ไม่มี ownerId (ทุกประเภท)
    const txsWithMissingOwnerId = await prisma.transaction.findMany({
        where: {
            OR: [
                { ownerName: { not: '' } },
            ],
            ownerId: null,
        },
        select: { id: true, ownerName: true, date: true, amount: true, paymentType: true }
    });

    console.log(`พบ ${txsWithMissingOwnerId.length} รายการที่มี ownerName แต่ไม่มี ownerId\n`);

    // 2. หา owners ทั้งหมด
    const owners = await prisma.owner.findMany({
        select: { id: true, name: true }
    });

    // สร้าง map สำหรับ lookup (case-insensitive)
    const ownerMap = new Map<string, string>();
    owners.forEach(o => ownerMap.set(o.name.toLowerCase().trim(), o.id));

    let updated = 0;
    const notFoundNames = new Set<string>();

    // 3. Batch update
    console.log('กำลัง update...');

    for (const tx of txsWithMissingOwnerId) {
        if (!tx.ownerName || tx.ownerName.trim() === '') continue;

        const normalizedName = tx.ownerName.toLowerCase().trim();
        const ownerId = ownerMap.get(normalizedName);

        if (ownerId) {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { ownerId }
            });
            updated++;
            if (updated % 10 === 0) {
                console.log(`  ✅ Updated ${updated} รายการ...`);
            }
        } else {
            notFoundNames.add(tx.ownerName);
        }
    }

    console.log(`\n✅ แก้ไขสำเร็จ: ${updated} รายการ`);

    if (notFoundNames.size > 0) {
        console.log(`\n⚠️ ไม่พบ owner ในระบบสำหรับชื่อเหล่านี้ (${notFoundNames.size} ชื่อ):`);
        Array.from(notFoundNames).forEach(name => console.log(`  - "${name}"`));
    }

    // 4. สรุปผลหลังแก้ไข
    console.log('\n=== สรุปผลหลังแก้ไข ===');

    const stillMissing = await prisma.transaction.count({
        where: {
            ownerName: { not: '' },
            ownerId: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        }
    });
    console.log(`จำนวน CREDIT/BOX_TRUCK ที่ยังไม่มี ownerId: ${stillMissing}`);

    // 5. ตรวจสอบ pending ของ แสบ
    const saebOwner = await prisma.owner.findFirst({ where: { name: 'แสบ' } });
    if (saebOwner) {
        const pendingTxs = await prisma.transaction.findMany({
            where: {
                ownerId: saebOwner.id,
                paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                invoiceId: null
            },
            orderBy: { date: 'desc' },
            take: 10,
            select: { date: true, amount: true }
        });
        console.log(`\n📊 แสบ - Pending transactions: ${pendingTxs.length} รายการล่าสุด:`);
        pendingTxs.forEach(tx => {
            console.log(`  ${tx.date.toISOString().split('T')[0]} | ${tx.amount.toLocaleString()} บาท`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
