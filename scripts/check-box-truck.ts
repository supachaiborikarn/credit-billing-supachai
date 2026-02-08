import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBoxTruckTransactions() {
    console.log('=== ตรวจสอบรายการรถตู้ทึบ (BOX_TRUCK) ช่วง 6-29 มกราคม 2026 ===\n');

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    console.log(`📅 ช่วงเวลา: ${startDate.toISOString()} ถึง ${endDate.toISOString()}\n`);

    // 1. Check all BOX_TRUCK payment type transactions in this period
    const boxTruckTransactions = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
        include: {
            owner: { select: { name: true, code: true, groupType: true } },
        },
        orderBy: { date: 'asc' },
    });

    console.log(`🚚 รายการ paymentType = BOX_TRUCK: ${boxTruckTransactions.length} รายการ`);

    // Group by invoiceId status
    const withInvoice = boxTruckTransactions.filter(t => t.invoiceId !== null);
    const withoutInvoice = boxTruckTransactions.filter(t => t.invoiceId === null);

    console.log(`   - มี invoice แล้ว: ${withInvoice.length} รายการ`);
    console.log(`   - ยังไม่มี invoice: ${withoutInvoice.length} รายการ\n`);

    // 2. Check owners with groupType = BOX_TRUCK
    const boxTruckOwners = await prisma.owner.findMany({
        where: { groupType: 'BOX_TRUCK' },
        select: { id: true, name: true, code: true },
    });

    console.log(`👥 เจ้าของในกลุ่ม groupType = BOX_TRUCK: ${boxTruckOwners.length} ราย`);
    boxTruckOwners.forEach(o => {
        console.log(`   - ${o.code || '-'}: ${o.name}`);
    });

    // 3. Check transactions from BOX_TRUCK owners in this period (any payment type)
    const ownerIds = boxTruckOwners.map(o => o.id);
    const ownerTransactions = await prisma.transaction.findMany({
        where: {
            ownerId: { in: ownerIds },
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
        include: {
            owner: { select: { name: true, code: true } },
        },
        orderBy: { date: 'asc' },
    });

    console.log(`\n📋 รายการจากเจ้าของกลุ่ม BOX_TRUCK: ${ownerTransactions.length} รายการ`);

    // Group by payment type
    const byPaymentType = ownerTransactions.reduce((acc, t) => {
        acc[t.paymentType] = (acc[t.paymentType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('   แยกตาม paymentType:');
    Object.entries(byPaymentType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} รายการ`);
    });

    // Check invoice status for owner transactions
    const ownerWithInvoice = ownerTransactions.filter(t => t.invoiceId !== null);
    const ownerWithoutInvoice = ownerTransactions.filter(t => t.invoiceId === null);

    console.log(`\n   สถานะใบวางบิล:`);
    console.log(`   - มี invoice แล้ว: ${ownerWithInvoice.length} รายการ`);
    console.log(`   - ยังไม่มี invoice: ${ownerWithoutInvoice.length} รายการ`);

    // 4. Detail of transactions without invoice
    if (ownerWithoutInvoice.length > 0) {
        console.log(`\n📝 รายละเอียดรายการที่ยังไม่มี invoice:`);
        ownerWithoutInvoice.slice(0, 20).forEach(t => {
            const dateStr = t.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
            console.log(`   ${dateStr} | ${t.licensePlate || '-'} | ${t.owner?.name || '-'} | ${t.paymentType} | ${Number(t.amount).toFixed(2)} บาท`);
        });
        if (ownerWithoutInvoice.length > 20) {
            console.log(`   ... และอีก ${ownerWithoutInvoice.length - 20} รายการ`);
        }
    }

    // 5. Check if any CREDIT/BOX_TRUCK transactions might be filtered incorrectly
    const creditBoxTruckNoInvoice = await prisma.transaction.findMany({
        where: {
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
            invoiceId: null,
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
        include: {
            owner: { select: { name: true, code: true, groupType: true } },
        },
    });

    console.log(`\n🔍 รายการ CREDIT/BOX_TRUCK ที่ยังไม่มี invoice (ช่วง 6-29 ม.ค.):`);
    console.log(`   พบ ${creditBoxTruckNoInvoice.length} รายการ`);

    // Group by owner
    const byOwner = creditBoxTruckNoInvoice.reduce((acc, t) => {
        const key = t.owner?.name || 'ไม่มีเจ้าของ';
        if (!acc[key]) acc[key] = { count: 0, amount: 0 };
        acc[key].count++;
        acc[key].amount += Number(t.amount);
        return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    console.log('\n   สรุปตามเจ้าของ:');
    Object.entries(byOwner)
        .sort((a, b) => b[1].amount - a[1].amount)
        .forEach(([owner, data]) => {
            console.log(`   - ${owner}: ${data.count} รายการ, ${data.amount.toFixed(2)} บาท`);
        });

    await prisma.$disconnect();
}

checkBoxTruckTransactions().catch(console.error);
