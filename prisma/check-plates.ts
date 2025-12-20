import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for 4636 and 6004 plates
    console.log('=== Checking plates 4636 and 6004 ===\n');

    const plates = ['4636', '6004'];

    for (const plate of plates) {
        console.log('--- Plate:', plate, '---');

        // Find all transactions with this plate (including partial match)
        const txs = await prisma.transaction.findMany({
            where: {
                licensePlate: { contains: plate }
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
                billBookNo: true,
                billNo: true,
            },
            orderBy: { date: 'desc' },
            take: 10
        });

        console.log('Total found:', txs.length);
        for (const t of txs) {
            const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
            console.log(`  ${t.stationId} | ${dateStr} | ${t.licensePlate} | ${t.ownerName} | ${t.amount} | book:${t.billBookNo || '-'} bill:${t.billNo || '-'}`);
        }
        console.log('');
    }

    // Check station-4 transactions today
    console.log('=== Station-4 ALL CREDIT transactions today ===');
    const s4Txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-4',
            date: { gte: today },
            paymentType: 'CREDIT'
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
        orderBy: { date: 'desc' }
    });
    console.log('Total:', s4Txs.length);
    for (const t of s4Txs) {
        const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${dateStr} | ${t.licensePlate} | ${t.ownerName?.substring(0, 20)} | ${t.amount} | book:${t.billBookNo || '-'} bill:${t.billNo || '-'}`);
    }

    // Check station-4 ALL วีระวณิชย์ transactions
    console.log('\n=== Station-4 ALL วีระวณิชย์ transactions (last 20) ===');
    const s4VtTxs = await prisma.transaction.findMany({
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
            amount: true,
            billBookNo: true,
            billNo: true,
        },
        orderBy: { date: 'desc' },
        take: 20
    });
    console.log('Total:', s4VtTxs.length);
    for (const t of s4VtTxs) {
        const dateStr = t.date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`  ${dateStr} | ${t.licensePlate} | ${t.amount} | book:${t.billBookNo || '-'} bill:${t.billNo || '-'}`);
    }

    await prisma.$disconnect();
}

check();
