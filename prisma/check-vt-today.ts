import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    // Check ศุภชัย (station-4) วีระวณิชย์ transactions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
            date: { gte: today },
            OR: [
                { ownerName: { contains: 'วีระวณิชย์' } },
                { owner: { name: { contains: 'วีระวณิชย์' } } }
            ]
        },
        select: {
            id: true,
            date: true,
            licensePlate: true,
            ownerName: true,
            amount: true,
            billBookNo: true,
            billNo: true,
        },
        orderBy: { date: 'asc' }
    });

    console.log('วีระวณิชย์ transactions at station-4 TODAY:', txs.length);
    for (const t of txs) {
        const time = t.date.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${time} | ${t.licensePlate} | bill ${t.billNo} | ${t.amount} บาท`);
    }

    // Check what plates are missing - compare to yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayTxs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
            date: { gte: yesterday, lt: today },
            OR: [
                { ownerName: { contains: 'วีระวณิชย์' } },
                { owner: { name: { contains: 'วีระวณิชย์' } } }
            ]
        },
        select: { licensePlate: true }
    });

    const yesterdayPlates = [...new Set(yesterdayTxs.map(t => t.licensePlate))];
    const todayPlates = [...new Set(txs.map(t => t.licensePlate))];

    console.log('\nวีระวณิชย์ plates YESTERDAY:', yesterdayPlates.join(', '));
    console.log('วีระวณิชย์ plates TODAY:', todayPlates.join(', '));

    // Find missing plates
    const missing = yesterdayPlates.filter(p => !todayPlates.includes(p));
    if (missing.length > 0) {
        console.log('\n⚠️ Missing plates today:', missing.join(', '));
    }

    await prisma.$disconnect();
}

check();
