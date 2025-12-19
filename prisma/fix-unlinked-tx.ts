/**
 * Check and Fix Unlinked Transactions
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndFixTransactions() {
    console.log('=== ตรวจสอบ Transactions ที่ยังไม่ link ===\n');

    // Find unlinked CREDIT/BOX_TRUCK transactions
    const unlinked = await prisma.transaction.findMany({
        where: {
            ownerId: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        select: {
            id: true,
            date: true,
            licensePlate: true,
            ownerName: true,
            amount: true,
            paymentType: true,
        },
        orderBy: { date: 'desc' }
    });

    console.log(`พบ ${unlinked.length} transactions ที่ยังไม่ link:\n`);

    // Group by ownerName
    const byName = new Map<string, typeof unlinked>();
    unlinked.forEach(tx => {
        const key = tx.ownerName || '(ไม่มีชื่อ)';
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(tx);
    });

    console.log('--- แยกตามชื่อ ---');
    byName.forEach((txs, name) => {
        console.log(`\n[${name}] - ${txs.length} รายการ`);
        txs.forEach(tx => {
            const date = new Date(tx.date).toLocaleDateString('th-TH');
            console.log(`  ${date} | ${tx.licensePlate || 'ไม่มีทะเบียน'} | ${Number(tx.amount).toFixed(2)} บาท | ${tx.paymentType}`);
        });
    });

    // Try to fix by matching ownerName
    console.log('\n\n=== พยายาม Fix โดยจับคู่ชื่อ ===\n');

    let fixed = 0;
    for (const tx of unlinked) {
        if (!tx.ownerName) continue;

        // Find owner by name (case insensitive)
        const owner = await prisma.owner.findFirst({
            where: {
                OR: [
                    { name: { contains: tx.ownerName, mode: 'insensitive' } },
                    { name: { equals: tx.ownerName, mode: 'insensitive' } }
                ]
            }
        });

        if (owner) {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { ownerId: owner.id }
            });
            console.log(`✓ Fixed: "${tx.ownerName}" → ${owner.name}`);
            fixed++;
        }
    }

    // Also try to match by license plate
    console.log('\n=== พยายาม Fix โดยจับคู่ทะเบียน ===\n');

    const stillUnlinked = await prisma.transaction.findMany({
        where: {
            ownerId: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
            licensePlate: { not: null }
        }
    });

    for (const tx of stillUnlinked) {
        if (!tx.licensePlate) continue;

        // Find truck by plate
        const truck = await prisma.truck.findFirst({
            where: { licensePlate: { contains: tx.licensePlate, mode: 'insensitive' } },
            include: { owner: true }
        });

        if (truck) {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                    ownerId: truck.owner.id,
                    truckId: truck.id
                }
            });
            console.log(`✓ Fixed by plate: "${tx.licensePlate}" → ${truck.owner.name}`);
            fixed++;
        }
    }

    // Final check
    const remaining = await prisma.transaction.count({
        where: {
            ownerId: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        }
    });

    console.log(`\n=== สรุป ===`);
    console.log(`Fixed: ${fixed}`);
    console.log(`ยังไม่ link: ${remaining}`);

    // List remaining
    if (remaining > 0) {
        console.log('\n--- รายการที่ยังไม่ link ---');
        const leftover = await prisma.transaction.findMany({
            where: {
                ownerId: null,
                paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
            },
            select: {
                id: true,
                date: true,
                licensePlate: true,
                ownerName: true,
                amount: true,
            }
        });
        leftover.forEach(tx => {
            const date = new Date(tx.date).toLocaleDateString('th-TH');
            console.log(`  ${date} | ${tx.licensePlate || ''} | ${tx.ownerName || ''} | ${Number(tx.amount).toFixed(2)} บาท`);
        });
    }

    console.log('\n✅ เสร็จ!');
    await prisma.$disconnect();
}

checkAndFixTransactions().catch(e => {
    console.error('Error:', e);
    prisma.$disconnect();
});
