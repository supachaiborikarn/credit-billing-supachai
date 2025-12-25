const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('=== ตรวจสอบ transactions ล่าสุดทั้งหมด ===\n');

    // Check all transactions from Dec 20-25
    const allRecent = await prisma.transaction.findMany({
        where: {
            date: { gte: new Date('2025-12-20') },
            deletedAt: null
        },
        orderBy: { date: 'desc' },
        take: 50
    });

    console.log(`📊 All transactions since Dec 20: ${allRecent.length} รายการ`);
    console.log('─'.repeat(100));

    allRecent.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        const ownerInfo = t.ownerName || t.driverName || 'N/A';
        console.log(`${i + 1}. ${dateStr} | ${ownerInfo.padEnd(15)} | ${t.paymentType?.padEnd(12) || 'N/A'} | ${t.amount} | ownerId: ${t.ownerId || 'null'}`);
    });

    // Check BOX_TRUCK specifically
    const boxTruckRecent = await prisma.transaction.findMany({
        where: {
            date: { gte: new Date('2025-12-20') },
            paymentType: 'BOX_TRUCK',
            deletedAt: null
        },
        orderBy: { date: 'desc' },
        take: 20
    });

    console.log(`\n📦 BOX_TRUCK transactions since Dec 20: ${boxTruckRecent.length} รายการ`);
    console.log('─'.repeat(100));

    boxTruckRecent.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        const ownerInfo = t.ownerName || 'N/A';
        console.log(`${i + 1}. ${dateStr} | ${ownerInfo.padEnd(15)} | ${t.paymentType} | ${t.amount}`);
    });

    // Check transactions with ownerName containing แสบ
    const saebByName = await prisma.transaction.findMany({
        where: {
            ownerName: { contains: 'แสบ' },
            deletedAt: null
        },
        orderBy: { date: 'desc' },
        take: 10
    });

    console.log(`\n🔎 Transactions by ownerName 'แสบ': ${saebByName.length} รายการล่าสุด`);
    console.log('─'.repeat(100));

    saebByName.forEach((t: any, i: number) => {
        const dateStr = t.date.toISOString().split('T')[0];
        console.log(`${i + 1}. ${dateStr} | ${t.ownerName} | ${t.paymentType} | ${t.amount} | ownerId: ${t.ownerId || 'null'}`);
    });

    // Count total transactions per day for last 10 days
    console.log('\n📅 จำนวน transactions ต่อวัน (10 วันล่าสุด):');
    console.log('─'.repeat(100));

    for (let i = 0; i <= 10; i++) {
        const date = new Date('2025-12-25');
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await prisma.transaction.count({
            where: {
                date: { gte: startOfDay, lte: endOfDay },
                deletedAt: null
            }
        });

        console.log(`${startOfDay.toISOString().split('T')[0]}: ${count} รายการ`);
    }

    await prisma.$disconnect();
}

check().catch(console.error);
