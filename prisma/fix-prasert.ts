const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPrasert() {
    console.log('=== แก้ไข บธ-964 → นายประเสริฐ นาคสุข ===\n');

    // Find or create นายประเสริฐ นาคสุข
    let prasert = await prisma.owner.findFirst({
        where: { name: { contains: 'ประเสริฐ  นาคสุข' } }
    });

    if (!prasert) {
        prasert = await prisma.owner.findFirst({
            where: {
                AND: [
                    { name: { contains: 'นาคสุข' } },
                    { name: { contains: 'ประเสริฐ' } },
                ]
            }
        });
    }

    if (!prasert) {
        // Create if not exists
        prasert = await prisma.owner.create({
            data: {
                name: 'นายประเสริฐ  นาคสุข',
                phone: '081-0462511',
                venderCode: '40000897',
                code: 'C345',
                groupType: 'SUGAR_FACTORY',
            }
        });
        console.log('✅ Created new owner:', prasert.name);
    } else {
        console.log('Found owner:', prasert.name, 'ID:', prasert.id);
    }

    // Update truck บธ-964
    const truckUpdate = await prisma.truck.updateMany({
        where: { licensePlate: 'บธ-964' },
        data: { ownerId: prasert.id }
    });
    console.log(`Updated truck: ${truckUpdate.count}`);

    // Update transactions
    const txnUpdate = await prisma.transaction.updateMany({
        where: {
            licensePlate: 'บธ-964',
            deletedAt: null
        },
        data: {
            ownerId: prasert.id,
            ownerName: prasert.name
        }
    });
    console.log(`Updated transactions: ${txnUpdate.count}`);

    // Verify
    const txns = await prisma.transaction.findMany({
        where: { licensePlate: 'บธ-964', deletedAt: null },
        select: { licensePlate: true, ownerName: true, date: true },
        orderBy: { date: 'desc' },
        take: 5
    });
    console.log('\nVerification:');
    txns.forEach((t: any) => console.log(`- ${t.licensePlate} → ${t.ownerName}`));

    await prisma.$disconnect();
}

fixPrasert();
