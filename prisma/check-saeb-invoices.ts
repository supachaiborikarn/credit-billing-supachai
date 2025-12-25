const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSaebInvoices() {
    console.log('=== ตรวจสอบข้อมูลวางบิลของ แสบ ===\n');

    // 1. หาเจ้าของชื่อ แสบ
    const owner = await prisma.owner.findFirst({
        where: { name: { contains: 'แสบ' } }
    });

    if (!owner) {
        console.log('❌ ไม่พบเจ้าของชื่อ แสบ');
        await prisma.$disconnect();
        return;
    }

    console.log('📋 ข้อมูลเจ้าของ:');
    console.log(`   ชื่อ: ${owner.name}`);
    console.log(`   ID: ${owner.id}`);
    console.log(`   Code: ${owner.code || 'N/A'}`);

    // 2. ตรวจสอบ transactions ทั้งหมดของ แสบ
    const allTransactions = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            deletedAt: null
        },
        orderBy: { date: 'desc' },
        take: 30,
        include: { truck: true }
    });

    console.log(`\n📊 30 Transactions ล่าสุด (เรียงจากใหม่สุด):`);
    console.log('─'.repeat(80));

    allTransactions.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        const licensePlate = t.truck?.licensePlate || t.licensePlate || 'N/A';
        const invoiceStatus = t.invoiceId ? `invoiceId: ${t.invoiceId}` : 'ยังไม่มีใบวางบิล';
        console.log(`${i + 1}. ${dateStr} | ${t.paymentType.padEnd(10)} | ${t.amount.toString().padStart(8)} บาท | ${licensePlate.padEnd(10)} | ${invoiceStatus}`);
    });

    // 3. หา transactions ที่ paymentType เป็น CREDIT หรือ BOX_TRUCK และยังไม่มี invoiceId
    const pendingForInvoice = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
            invoiceId: null,
            deletedAt: null
        },
        orderBy: { date: 'desc' }
    });

    console.log(`\n💰 รายการรอวางบิล (CREDIT/BOX_TRUCK + ไม่มี invoiceId): ${pendingForInvoice.length} รายการ`);
    console.log('─'.repeat(80));

    pendingForInvoice.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        console.log(`${i + 1}. ${dateStr} | ${t.paymentType.padEnd(10)} | ${t.amount.toString().padStart(8)} บาท`);
    });

    // 4. ดูว่าหลังวันที่ 19 ธค มี transactions ไหม
    const after19Dec = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            date: { gt: new Date('2025-12-19T23:59:59') },
            deletedAt: null
        },
        orderBy: { date: 'desc' }
    });

    console.log(`\n📅 Transactions หลังวันที่ 19 ธค 2025: ${after19Dec.length} รายการ`);
    console.log('─'.repeat(80));

    after19Dec.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString();
        console.log(`${i + 1}. ${dateStr} | ${t.paymentType.padEnd(10)} | ${t.amount.toString().padStart(8)} บาท | invoiceId: ${t.invoiceId || 'null'}`);
    });

    // 5. ตรวจสอบ invoices ที่เกี่ยวข้องกับ แสบ
    const invoices = await prisma.invoice.findMany({
        where: { ownerId: owner.id },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { transactions: true } }
        }
    });

    console.log(`\n📄 ใบวางบิลของ แสบ: ${invoices.length} ใบ`);
    console.log('─'.repeat(80));

    invoices.forEach((inv: any, i: number) => {
        const dateStr = inv.createdAt.toISOString().split('T')[0];
        console.log(`${i + 1}. ${inv.invoiceNumber} | สร้างเมื่อ: ${dateStr} | ยอด: ${inv.totalAmount} บาท | สถานะ: ${inv.status} | จำนวนรายการ: ${inv._count.transactions}`);
    });

    await prisma.$disconnect();
}

checkSaebInvoices().catch(console.error);
