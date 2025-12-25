const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    // Find owner แสบ
    const owner = await prisma.owner.findFirst({
        where: { name: { contains: 'แสบ' } }
    });

    if (!owner) {
        console.log('ไม่พบเจ้าของชื่อ แสบ');
        await prisma.$disconnect();
        return;
    }

    console.log('Owner:', owner.name, 'ID:', owner.id);

    // Get all transactions
    const txns = await prisma.transaction.findMany({
        where: {
            ownerId: owner.id,
            deletedAt: null,
        },
        orderBy: { date: 'desc' },
        take: 20,
        select: { date: true, licensePlate: true, amount: true, paymentType: true }
    });

    console.log('\nLatest transactions by ownerId:');
    txns.forEach((t: any) => {
        const date = t.date.toISOString().split('T')[0];
        console.log(`- ${date} | ${t.licensePlate} | ${t.paymentType} | ${t.amount}`);
    });

    // Check by name in ownerName field
    const byName = await prisma.transaction.findMany({
        where: {
            ownerName: { contains: 'แสบ' },
            deletedAt: null,
        },
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true, licensePlate: true, amount: true, ownerId: true }
    });

    console.log('\nTransactions by ownerName แสบ:');
    byName.forEach((t: any) => {
        const date = t.date.toISOString().split('T')[0];
        console.log(`- ${date} | ${t.licensePlate} | ${t.amount} | ownerId: ${t.ownerId || 'NULL'}`);
    });

    await prisma.$disconnect();
}
check();
