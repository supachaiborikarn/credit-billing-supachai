import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    // 1. Check all stations
    const stations = await prisma.station.findMany({
        select: { id: true, name: true }
    });
    console.log('=== ALL STATIONS ===');
    for (const s of stations) {
        console.log(s.id, '-', s.name);
    }

    // 2. Check วีระวณิชย์ owner status
    const owners = await prisma.owner.findMany({
        where: { name: { contains: 'วีระวณิชย์' } },
        select: {
            id: true,
            name: true,
            deletedAt: true,
            groupType: true,
            code: true,
        }
    });
    console.log('\n=== วีระวณิชย์ OWNERS ===');
    console.log(JSON.stringify(owners, null, 2));

    // 3. Check recent transactions for วีระวณิชย์
    const now = new Date();
    const last4Hours = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    const recentTx = await prisma.transaction.findMany({
        where: {
            createdAt: { gte: last4Hours },
            OR: [
                { ownerName: { contains: 'วีระวณิชย์' } },
                { owner: { name: { contains: 'วีระวณิชย์' } } }
            ]
        },
        select: {
            id: true,
            stationId: true,
            date: true,
            createdAt: true,
            licensePlate: true,
            ownerName: true,
            amount: true,
            paymentType: true,
        },
        orderBy: { createdAt: 'desc' }
    });
    console.log('\n=== RECENT TRANSACTIONS (last 4 hours) วีระวณิชย์ ===');
    for (const t of recentTx) {
        console.log(`${t.stationId} | ${t.date.toLocaleString('th-TH')} | ${t.licensePlate} | ${t.amount} | ${t.paymentType}`);
    }

    // 4. Check station-1 CREDIT today
    const s1Today = new Date();
    s1Today.setHours(0, 0, 0, 0);

    const s1Tx = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: s1Today },
            paymentType: 'CREDIT'
        },
        select: {
            licensePlate: true,
            ownerName: true,
            amount: true,
        },
        orderBy: { date: 'desc' },
        take: 10
    });
    console.log('\n=== Station-1 CREDIT transactions today (last 10) ===');
    for (const t of s1Tx) {
        console.log(`${t.licensePlate} | ${t.ownerName} | ${t.amount}`);
    }

    // 5. Check specific error - see if there are any duplicate bill issues
    console.log('\n=== CHECKING FOR POTENTIAL ISSUES ===');

    // Check for transactions that might have failed to save today
    const allCreditToday = await prisma.transaction.count({
        where: {
            date: { gte: s1Today },
            paymentType: 'CREDIT'
        }
    });
    console.log('Total CREDIT transactions today:', allCreditToday);

    // Check for any transactions from station-1 with วีระวณิชย์ today
    const s1VtToday = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: s1Today },
            OR: [
                { ownerName: { contains: 'วีระวณิชย์' } },
                { owner: { name: { contains: 'วีระวณิชย์' } } }
            ]
        }
    });
    console.log('Station-1 วีระวณิชย์ transactions today:', s1VtToday.length);

    await prisma.$disconnect();
}

check();
