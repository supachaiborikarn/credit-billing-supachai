const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeAll() {
    // Pairs to merge: [fromId, toId, correctName]
    const merges = [
        // ฉั่วการช่าง -> หจก.ฉั่วการช่าง
        ['cd184ce2-91fa-4b94-a982-234bb5a2a28b', '090ebcaa-504a-4787-b8da-f3d6d6874617', 'หจก.ฉั่วการช่าง'],

        // นายณัฐพล  แย้มสะอาด (มี trucks 2) -> นายณัฐพล แย้มสะอาด (มี txs 7)
        ['78005e75-ad75-496a-a321-b4914304d6df', '79b91644-4d20-4903-aa01-b27d5acb0174', 'นายณัฐพล แย้มสะอาด'],

        // นายประเสริฐ  นาคสุข (มี trucks 1) -> นายประเสริฐ นาคสุข (มี txs 11)
        ['340329da-6118-4c8a-89bf-d6d59bbfc525', '98e83b5b-f1f1-4f99-abae-e4b55967d1bf', 'นายประเสริฐ นาคสุข'],

        // นายภิรมย์  จงมีความสุข (มี trucks 3) -> นายภิรมย์ จงมีความสุข (มี txs 8)
        ['15081f02-7fd2-4e7b-9f9a-1f626cac7dcc', 'f4e3c38d-6535-4b43-8871-a161d576bbbe', 'นายภิรมย์ จงมีความสุข'],

        // นายศุภชัย  งามประเสริฐ (มี trucks 2) -> นายศุภชัย งามประเสริฐ (มี txs 3)
        ['127e9219-6cb2-436c-9e80-69976cb779ad', '79616a46-f284-4bbf-87eb-528ee78175b8', 'นายศุภชัย งามประเสริฐ'],

        // ศุภชัย งามประเสริฐ (ไม่มีคำนำหน้า) -> นายศุภชัย งามประเสริฐ
        ['040ba2c8-891a-4c14-906b-c259e39649c2', '79616a46-f284-4bbf-87eb-528ee78175b8', 'นายศุภชัย งามประเสริฐ'],
    ];

    for (const [fromId, toId, correctName] of merges) {
        // Get from owner name for logging
        const fromOwner = await prisma.owner.findUnique({ where: { id: fromId }, select: { name: true } });
        if (!fromOwner) {
            console.log('Skip (already deleted):', fromId);
            continue;
        }

        // Move transactions
        const txResult = await prisma.transaction.updateMany({
            where: { ownerId: fromId },
            data: { ownerId: toId, ownerName: correctName }
        });

        // Move trucks
        const truckResult = await prisma.truck.updateMany({
            where: { ownerId: fromId },
            data: { ownerId: toId }
        });

        // Delete old owner
        await prisma.owner.delete({ where: { id: fromId } });

        console.log('Merged:', fromOwner.name, '->', correctName);
        console.log('  Transactions moved:', txResult.count, '| Trucks moved:', truckResult.count);
    }

    console.log('\n✅ All merges complete!');

    await prisma.$disconnect();
}

mergeAll();
