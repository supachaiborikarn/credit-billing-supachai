const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // หา transactions วันนี้ที่ CREDIT
    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: today },
            paymentType: 'CREDIT'
        },
        select: {
            id: true,
            licensePlate: true,
            ownerName: true,
            ownerId: true,
            owner: { select: { name: true } }
        },
        take: 50
    });

    console.log('CREDIT transactions today:', txs.length);

    const missing = txs.filter((t: { owner?: { name: string } | null; ownerName: string | null }) =>
        !t.owner?.name && !t.ownerName
    );
    const withOwner = txs.filter((t: { owner?: { name: string } | null; ownerName: string | null }) =>
        t.owner?.name || t.ownerName
    );

    console.log('With owner name:', withOwner.length);
    console.log('Missing owner name:', missing.length);

    if (missing.length > 0) {
        console.log('\nTransactions missing owner:');
        for (const t of missing) {
            console.log(`- License: ${t.licensePlate} | ownerId: ${t.ownerId || 'NULL'}`);
        }
    }

    // แสดงตัวอย่างที่มีชื่อ
    console.log('\nSample with owner:');
    for (const t of withOwner.slice(0, 5)) {
        console.log(`- License: ${t.licensePlate} | name: ${t.owner?.name || t.ownerName}`);
    }

    await prisma.$disconnect();
}

check();
