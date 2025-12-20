import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('=== แท๊งลอย (Station-1) วันที่ 19 ธันวาคม 2025 ===\n');

    // Get transactions for Dec 19
    const startOfDay = new Date('2025-12-19T00:00:00+07:00');
    startOfDay.setHours(startOfDay.getHours() - 7); // Convert to UTC

    const endOfDay = new Date('2025-12-19T23:59:59+07:00');
    endOfDay.setHours(endOfDay.getHours() - 7); // Convert to UTC

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: startOfDay, lte: endOfDay },
            deletedAt: null,
        },
        select: {
            id: true,
            date: true,
            licensePlate: true,
            ownerName: true,
            liters: true,
            pricePerLiter: true,
            amount: true,
            paymentType: true,
            billBookNo: true,
            billNo: true,
            productType: true,
        },
        orderBy: { date: 'asc' }
    });

    console.log('Total transactions in system:', txs.length);

    // Group by payment type
    const cash = txs.filter(t => t.paymentType === 'CASH');
    const credit = txs.filter(t => t.paymentType === 'CREDIT');
    const transfer = txs.filter(t => t.paymentType === 'TRANSFER');
    const boxTruck = txs.filter(t => t.paymentType === 'BOX_TRUCK');

    console.log('\n--- Summary by Payment Type ---');
    console.log('CASH:', cash.length, 'transactions, Total:', cash.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2), 'บาท');
    console.log('CREDIT:', credit.length, 'transactions, Total:', credit.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2), 'บาท');
    console.log('TRANSFER:', transfer.length, 'transactions, Total:', transfer.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2), 'บาท');
    console.log('BOX_TRUCK:', boxTruck.length, 'transactions, Total:', boxTruck.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2), 'บาท');

    // Total liters
    const totalLiters = txs.reduce((sum, t) => sum + Number(t.liters || 0), 0);
    const totalAmount = txs.reduce((sum, t) => sum + Number(t.amount), 0);
    console.log('\n--- Grand Total ---');
    console.log('Total Liters:', totalLiters.toFixed(2));
    console.log('Total Amount:', totalAmount.toFixed(2), 'บาท');

    // List CREDIT transactions (matching the paper records)
    console.log('\n=== CREDIT Transactions (เงินเชื่อ) ===');
    console.log('Count:', credit.length);
    let creditTotal = 0;
    let creditLiters = 0;
    for (const t of credit) {
        const liters = Number(t.liters || 0);
        const amount = Number(t.amount);
        creditLiters += liters;
        creditTotal += amount;
        console.log(`  ${t.licensePlate?.padEnd(20)} | ${liters.toFixed(2).padStart(8)} L | ${amount.toFixed(2).padStart(10)} บาท | ${t.ownerName?.substring(0, 15)}`);
    }
    console.log(`\n  CREDIT Total: ${creditLiters.toFixed(2)} ลิตร = ${creditTotal.toFixed(2)} บาท`);

    // List BOX_TRUCK transactions
    console.log('\n=== BOX_TRUCK Transactions ===');
    console.log('Count:', boxTruck.length);
    for (const t of boxTruck) {
        console.log(`  ${t.licensePlate?.padEnd(20)} | ${Number(t.liters || 0).toFixed(2).padStart(8)} L | ${Number(t.amount).toFixed(2).padStart(10)} บาท | ${t.ownerName?.substring(0, 15)}`);
    }

    await prisma.$disconnect();
}

check();
