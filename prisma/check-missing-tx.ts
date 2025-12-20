import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('=== Checking Station-1 (แท๊งลอย) Bill 715/35707 ===\n');

    // 1. Check for the specific bill
    const tx = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            OR: [
                { billBookNo: '715', billNo: '35707' },
                { billBookNo: '0715', billNo: '35707' },
                { billNo: '35707' },
            ]
        },
        select: {
            id: true,
            date: true,
            createdAt: true,
            licensePlate: true,
            ownerName: true,
            ownerId: true,
            owner: { select: { name: true, code: true } },
            billBookNo: true,
            billNo: true,
            amount: true,
            paymentType: true,
            deletedAt: true,
            isVoided: true,
        },
    });

    console.log('Found transactions with bill 35707:', tx.length);
    for (const t of tx) {
        const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        const createdStr = t.createdAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`\n  ID: ${t.id}`);
        console.log(`  Date: ${dateStr}`);
        console.log(`  Created: ${createdStr}`);
        console.log(`  Plate: ${t.licensePlate}`);
        console.log(`  Owner: ${t.ownerName} | ${t.owner?.name} | Code: ${t.owner?.code}`);
        console.log(`  Bill: book ${t.billBookNo} / no ${t.billNo}`);
        console.log(`  Amount: ${t.amount} | Type: ${t.paymentType}`);
        console.log(`  Deleted: ${t.deletedAt} | Voided: ${t.isVoided}`);
    }

    // 2. Check for C116 owner
    console.log('\n=== Checking owner C116 ===');
    const c116 = await prisma.owner.findMany({
        where: {
            OR: [
                { code: { contains: '116' } },
                { code: 'C116' },
                { code: 'c116' },
            ]
        },
        select: {
            id: true,
            name: true,
            code: true,
            deletedAt: true,
        }
    });
    console.log('Found owners with code 116:', c116.length);
    for (const o of c116) {
        console.log(`  ${o.code} | ${o.name} | deleted: ${o.deletedAt}`);
    }

    // 3. Check transactions on Dec 19 for station-1
    console.log('\n=== Station-1 transactions on Dec 19, 2024 ===');
    const dec19Start = new Date('2024-12-19T00:00:00+07:00');
    const dec19End = new Date('2024-12-19T23:59:59+07:00');

    const dec19Txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: {
                gte: dec19Start,
                lte: dec19End
            }
        },
        select: {
            id: true,
            date: true,
            licensePlate: true,
            ownerName: true,
            billBookNo: true,
            billNo: true,
            amount: true,
            paymentType: true,
            deletedAt: true,
        },
        orderBy: { date: 'asc' }
    });

    console.log('Total transactions on Dec 19:', dec19Txs.length);

    // Filter by book 715
    const book715 = dec19Txs.filter(t => t.billBookNo === '715' || t.billBookNo === '0715');
    console.log('\nTransactions with book 715:');
    for (const t of book715) {
        const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${dateStr} | ${t.licensePlate} | bill ${t.billNo} | ${t.amount} | deleted: ${t.deletedAt}`);
    }

    // 4. Check all bills in book 715 around 35707
    console.log('\n=== All bills 35700-35710 in book 715 ===');
    const nearbyBills = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            billBookNo: { in: ['715', '0715'] },
            billNo: { in: ['35700', '35701', '35702', '35703', '35704', '35705', '35706', '35707', '35708', '35709', '35710'] }
        },
        select: {
            date: true,
            licensePlate: true,
            ownerName: true,
            billBookNo: true,
            billNo: true,
            amount: true,
            deletedAt: true,
            isVoided: true,
        },
        orderBy: { billNo: 'asc' }
    });

    for (const t of nearbyBills) {
        const dateStr = t.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
        const status = t.deletedAt ? '❌DELETED' : (t.isVoided ? '⚠️VOIDED' : '✅OK');
        console.log(`  Bill ${t.billNo} | ${dateStr} | ${t.licensePlate} | ${t.ownerName?.substring(0, 15)} | ${t.amount} | ${status}`);
    }

    await prisma.$disconnect();
}

check();
