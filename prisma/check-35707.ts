import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('=== Deep Search for Bill 35707 ===\n');

    // 1. Search ALL stations for bill 35707 (including deleted)
    const allTx = await prisma.$queryRaw`
        SELECT 
            id, 
            "stationId", 
            date, 
            "licensePlate", 
            "ownerName",
            "billBookNo",
            "billNo",
            amount,
            "deletedAt",
            "isVoided",
            "createdAt"
        FROM transactions 
        WHERE "billNo" = '35707'
    `;

    console.log('All transactions with bill 35707 (including deleted):');
    console.log(allTx);

    // 2. Search by book 715 and nearby bills
    const nearby = await prisma.$queryRaw`
        SELECT 
            id,
            "stationId",
            date,
            "licensePlate",
            "ownerName",
            "billBookNo",
            "billNo",
            amount,
            "deletedAt",
            "isVoided"
        FROM transactions 
        WHERE "billBookNo" IN ('715', '0715')
        AND CAST("billNo" AS INTEGER) BETWEEN 35705 AND 35710
        ORDER BY "billNo"
    `;

    console.log('\nBills 35705-35710 in book 715 (including deleted):');
    console.log(nearby);

    // 3. Check if there's a duplicate check happening
    console.log('\n=== Checking duplicate detection logic ===');
    const duplicateCheck = await prisma.transaction.findMany({
        where: {
            billBookNo: { in: ['715', '0715'] },
            billNo: '35707',
        }
    });
    console.log('Duplicate check result:', duplicateCheck.length > 0 ? 'FOUND' : 'NOT FOUND');

    // 4. Also check with raw query including deleted
    const rawCheck = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM transactions 
        WHERE "billBookNo" IN ('715', '0715') 
        AND "billNo" = '35707'
    `;
    console.log('Raw count (including all):', rawCheck);

    await prisma.$disconnect();
}

check();
