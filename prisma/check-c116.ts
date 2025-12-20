import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    // Search for owner similar to C116
    console.log('=== Searching for owner C116 ===\n');

    const owners = await prisma.owner.findMany({
        where: {
            OR: [
                { code: { contains: '116', mode: 'insensitive' } },
                { name: { contains: 'C116', mode: 'insensitive' } },
            ]
        },
        select: { id: true, name: true, code: true, deletedAt: true }
    });
    console.log('Owners with 116:');
    for (const o of owners) {
        console.log(`  ${o.code} | ${o.name} | deleted: ${o.deletedAt}`);
    }

    // Also check all codes starting with C
    console.log('\n=== All C codes ===');
    const cCodes = await prisma.owner.findMany({
        where: {
            code: { startsWith: 'C', mode: 'insensitive' },
            deletedAt: null
        },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
    });
    console.log('Total C codes:', cCodes.length);
    for (const o of cCodes) {
        console.log(`  ${o.code} | ${o.name}`);
    }

    // Check recent bills in book 715 today
    console.log('\n=== Recent bills in book 715 (last 20) ===');
    const recentBills = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            billBookNo: { in: ['715', '0715'] },
        },
        select: {
            date: true,
            licensePlate: true,
            ownerName: true,
            owner: { select: { code: true } },
            billNo: true,
            amount: true,
        },
        orderBy: { billNo: 'desc' },
        take: 20
    });

    for (const t of recentBills) {
        const dateStr = t.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${t.billNo} | ${dateStr} | ${t.licensePlate} | ${t.owner?.code || '-'} | ${t.ownerName?.substring(0, 20)}`);
    }

    await prisma.$disconnect();
}

check();
