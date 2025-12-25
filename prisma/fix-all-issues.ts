const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAll() {
    console.log('=== 1. แก้ไข บธ-964 → ประเสริฐ นาคสุข ===\n');

    // Find ประเสริฐ นาคสุข
    const prasert = await prisma.owner.findFirst({
        where: { name: { contains: 'ประเสริฐ' } }
    });

    if (prasert) {
        console.log('Found ประเสริฐ:', prasert.name, 'ID:', prasert.id);

        // Update truck
        const truck964 = await prisma.truck.updateMany({
            where: { licensePlate: 'บธ-964' },
            data: { ownerId: prasert.id }
        });
        console.log(`Updated truck: ${truck964.count}`);

        // Update transactions
        const txn964 = await prisma.transaction.updateMany({
            where: { licensePlate: 'บธ-964', deletedAt: null },
            data: { ownerId: prasert.id, ownerName: prasert.name }
        });
        console.log(`Updated transactions: ${txn964.count}`);
    }

    console.log('\n=== 2. แก้ทะเบียนที่มี C-Code ปน ===\n');

    // Fix plates with space+C pattern
    const platesToFix = [
        { from: '82-7192 C172', to: 'กพ82-7192' },
        { from: 'กพ81-3585 C345', to: 'กพ81-3585' },
        { from: '81-4119 C164', to: 'กพ81-4119' },
    ];

    for (const fix of platesToFix) {
        // Fix in trucks
        const truckFix = await prisma.truck.updateMany({
            where: { licensePlate: fix.from },
            data: { licensePlate: fix.to }
        });

        // Fix in transactions  
        const txnFix = await prisma.transaction.updateMany({
            where: { licensePlate: fix.from, deletedAt: null },
            data: { licensePlate: fix.to }
        });

        console.log(`${fix.from} → ${fix.to}: trucks=${truckFix.count}, txns=${txnFix.count}`);
    }

    console.log('\n=== 3. Link 82-0901 → ท่าทรายถาวร ===\n');

    const thasai = await prisma.owner.findFirst({
        where: { name: { contains: 'ท่าทราย' } }
    });

    if (thasai) {
        console.log('Found ท่าทรายถาวร ID:', thasai.id);

        // Find truck 82-0901
        let truck0901 = await prisma.truck.findFirst({
            where: { licensePlate: '82-0901' }
        });

        if (!truck0901) {
            // Check if exists with different format
            truck0901 = await prisma.truck.findFirst({
                where: { licensePlate: { contains: '0901' } }
            });
        }

        if (truck0901) {
            console.log('Found truck:', truck0901.licensePlate);
        } else {
            console.log('Creating truck 82-0901');
            truck0901 = await prisma.truck.create({
                data: {
                    licensePlate: '82-0901',
                    ownerId: thasai.id,
                }
            });
        }

        // Update yesterday's transactions
        const yesterday = new Date('2025-12-24T00:00:00+07:00');
        const today = new Date('2025-12-25T00:00:00+07:00');

        const txn0901 = await prisma.transaction.updateMany({
            where: {
                licensePlate: '82-0901',
                date: { gte: yesterday, lt: today },
                deletedAt: null,
            },
            data: {
                ownerId: thasai.id,
                ownerName: thasai.name,
                truckId: truck0901.id,
            }
        });
        console.log(`Updated ${txn0901.count} transactions`);
    }

    console.log('\n=== 4. ตรวจสอบผลลัพธ์ ===\n');

    const yesterday = new Date('2025-12-24T00:00:00+07:00');
    const today = new Date('2025-12-25T00:00:00+07:00');

    const check = await prisma.transaction.findMany({
        where: {
            paymentType: 'CREDIT',
            date: { gte: yesterday, lt: today },
            OR: [
                { ownerName: null },
                { ownerId: null },
            ],
            deletedAt: null,
        },
        select: { licensePlate: true, ownerName: true, amount: true }
    });

    console.log('Transactions still missing owner:');
    if (check.length === 0) {
        console.log('✅ All CREDIT transactions have owners!');
    } else {
        check.forEach((t: any) => console.log(`- ${t.licensePlate}: ${t.ownerName || 'NO NAME'}`));
    }

    await prisma.$disconnect();
}

fixAll();
