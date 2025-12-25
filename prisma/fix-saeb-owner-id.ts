const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSaebOwnerIds() {
    console.log('=== แก้ไข ownerId ของธุรกรรมแสบ ===\n');

    // 1. หาเจ้าของชื่อ แสบ
    const owner = await prisma.owner.findFirst({
        where: { name: { contains: 'แสบ' } }
    });

    if (!owner) {
        console.log('❌ ไม่พบเจ้าของชื่อ แสบ');
        await prisma.$disconnect();
        return;
    }

    console.log(`📋 พบเจ้าของ: ${owner.name} (ID: ${owner.id})\n`);

    // 2. หา transactions ที่มี ownerName เป็น 'แสบ' แต่ ownerId เป็น null
    const transactionsToFix = await prisma.transaction.findMany({
        where: {
            ownerName: { contains: 'แสบ' },
            ownerId: null,
            deletedAt: null
        },
        orderBy: { date: 'desc' }
    });

    console.log(`🔍 พบ ${transactionsToFix.length} รายการที่ต้องแก้ไข:\n`);

    if (transactionsToFix.length === 0) {
        console.log('✅ ไม่มีรายการที่ต้องแก้ไข');
        await prisma.$disconnect();
        return;
    }

    // แสดงรายการที่จะแก้ไข
    transactionsToFix.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        console.log(`${i + 1}. ${dateStr} | ${t.ownerName} | ${t.paymentType} | ${t.amount} บาท`);
    });

    // 3. อัปเดต ownerId
    console.log('\n🔧 กำลังอัปเดต ownerId...\n');

    const result = await prisma.transaction.updateMany({
        where: {
            ownerName: { contains: 'แสบ' },
            ownerId: null,
            deletedAt: null
        },
        data: {
            ownerId: owner.id
        }
    });

    console.log(`✅ อัปเดตสำเร็จ ${result.count} รายการ\n`);

    // 4. ตรวจสอบผลลัพธ์
    const verifyAfter = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            date: { gte: new Date('2025-12-20') },
            deletedAt: null
        },
        orderBy: { date: 'desc' },
        take: 10
    });

    console.log(`📊 ตรวจสอบหลังแก้ไข - Transactions หลัง 20 ธค: ${verifyAfter.length} รายการ`);
    verifyAfter.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        console.log(`${i + 1}. ${dateStr} | ${t.paymentType} | ${t.amount} บาท | ownerId: ${t.ownerId}`);
    });

    // 5. ตรวจสอบรายการรอวางบิล (invoiceId = null)
    const pendingForInvoice = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
            invoiceId: null,
            deletedAt: null
        },
        orderBy: { date: 'desc' }
    });

    console.log(`\n💰 รายการรอวางบิล (ยังไม่มี invoiceId): ${pendingForInvoice.length} รายการ`);

    const totalPending = pendingForInvoice.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    console.log(`💵 ยอดรวมรอวางบิล: ${totalPending.toLocaleString()} บาท`);

    await prisma.$disconnect();
}

fixSaebOwnerIds().catch(console.error);
