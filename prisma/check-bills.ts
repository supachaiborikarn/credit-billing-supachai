import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    // Check for duplicate bill numbers in station-4 book 095
    console.log('=== Checking bill numbers in book 095 ===');

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
            billBookNo: '095'
        },
        select: {
            id: true,
            date: true,
            licensePlate: true,
            billNo: true,
            amount: true,
        },
        orderBy: { billNo: 'asc' }
    });

    // Find the highest bill number
    const billNos = txs.map(t => parseInt(t.billNo || '0')).filter(n => n > 0);
    console.log('Total transactions in book 095:', txs.length);
    console.log('Highest bill number:', Math.max(...billNos));

    // Show recent bills
    console.log('\nRecent bills (last 15):');
    const sorted = [...txs].sort((a, b) => parseInt(b.billNo || '0') - parseInt(a.billNo || '0'));
    sorted.slice(0, 15).forEach(t => {
        const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log('  Bill ' + t.billNo + ' | ' + dateStr + ' | ' + t.licensePlate + ' | ' + t.amount);
    });

    // Check for duplicates
    console.log('\n=== Checking for duplicate bill numbers ===');
    const billNoCount: { [key: string]: number } = {};
    txs.forEach(t => {
        if (t.billNo) {
            billNoCount[t.billNo] = (billNoCount[t.billNo] || 0) + 1;
        }
    });
    const duplicates = Object.entries(billNoCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
        console.log('Found duplicate bill numbers:');
        duplicates.forEach(([billNo, count]) => {
            console.log('  Bill ' + billNo + ' appears ' + count + ' times');
        });
    } else {
        console.log('No duplicate bill numbers found in book 095');
    }

    await prisma.$disconnect();
}

check();
