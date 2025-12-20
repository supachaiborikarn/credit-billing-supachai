import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('=== Checking all bill books used for วีระวณิชย์ at station-4 ===\n');

    // Find all bill books used for วีระวณิชย์
    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
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
            billBookNo: true,
            billNo: true,
            amount: true,
        },
        orderBy: { date: 'desc' },
    });

    console.log('All วีระวณิชย์ transactions at station-4:');
    for (const t of txs) {
        const dateStr = t.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${dateStr} | ${t.licensePlate?.padEnd(6)} | book:${t.billBookNo || '-'} bill:${t.billNo || '-'} | ${t.amount}`);
    }

    // Find the next available bill number for book 095
    console.log('\n=== Next available bill numbers ===');
    const book095 = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
            billBookNo: '095'
        },
        select: { billNo: true },
    });

    const billNos = book095.map(t => parseInt(t.billNo || '0')).filter(n => n > 0);
    const maxBill = Math.max(...billNos);
    console.log('Book 095 - Highest bill used:', maxBill);
    console.log('Next available bill for book 095:', maxBill + 1);

    // Check what bills from 4735-4750 are used
    console.log('\n=== Bill usage 4720-4750 in book 095 ===');
    for (let i = 4720; i <= 4750; i++) {
        const exists = book095.find(t => t.billNo === String(i));
        console.log(`  Bill ${i}: ${exists ? '✅ Used' : '❌ Available'}`);
    }

    await prisma.$disconnect();
}

check();
