import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 กำลังแก้ไข ownerId ที่หายไป...\n');

    // 1. หา transactions ที่มี ownerName แต่ไม่มี ownerId
    const txsWithMissingOwnerId = await prisma.transaction.findMany({
        where: {
            ownerName: { not: '' },
            ownerId: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        select: { id: true, ownerName: true, date: true, amount: true }
    });

    console.log('พบ', txsWithMissingOwnerId.length, 'รายการที่ต้องแก้ไข');

    // 2. หา owners ทั้งหมด
    const owners = await prisma.owner.findMany({
        select: { id: true, name: true }
    });

    // สร้าง map สำหรับ lookup
    const ownerMap = new Map<string, string>();
    owners.forEach(o => ownerMap.set(o.name.toLowerCase().trim(), o.id));

    let updated = 0;
    const notFound: string[] = [];

    // 3. Update ทีละรายการ
    for (const tx of txsWithMissingOwnerId) {
        const normalizedName = tx.ownerName?.toLowerCase().trim();
        if (!normalizedName) continue;

        const ownerId = ownerMap.get(normalizedName);

        if (ownerId) {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { ownerId }
            });
            updated++;
            console.log(`  ✅ Updated: ${tx.ownerName} -> ${ownerId.substring(0, 8)}...`);
        } else {
            if (!notFound.includes(tx.ownerName || '')) {
                notFound.push(tx.ownerName || '(empty)');
            }
        }
    }

    console.log('\n✅ แก้ไขสำเร็จ:', updated, 'รายการ');

    if (notFound.length > 0) {
        console.log('\n⚠️ ไม่พบ owner สำหรับชื่อเหล่านี้:');
        notFound.forEach(name => console.log('  -', name));
    }

    // 4. ตรวจสอบ transactions ของ แสบ วันที่ 17 อีกครั้ง
    console.log('\n--- ตรวจสอบ transactions ของ แสบ วันที่ 17 หลังแก้ไข ---');
    const fixedTxs = await prisma.transaction.findMany({
        where: {
            ownerName: 'แสบ',
            date: {
                gte: new Date('2025-12-17T00:00:00+07:00'),
                lte: new Date('2025-12-17T23:59:59+07:00'),
            }
        },
        select: { id: true, date: true, ownerId: true, amount: true }
    });

    fixedTxs.forEach(tx => {
        const status = tx.ownerId ? '✅ มี ownerId' : '❌ null';
        console.log(`  ${tx.date.toISOString()} | ${status} | Amount: ${tx.amount}`);
    });

    // 5. ตรวจสอบ pending transactions ของ แสบ
    const saebOwner = await prisma.owner.findFirst({ where: { name: 'แสบ' } });
    if (saebOwner) {
        const pendingCount = await prisma.transaction.count({
            where: {
                ownerId: saebOwner.id,
                paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                invoiceId: null
            }
        });
        console.log(`\n📊 จำนวน pending transactions ของ แสบ: ${pendingCount} รายการ`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
