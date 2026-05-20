import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Look at BOX_TRUCK transactions not billed
    const unbilledBoxTrucks = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            invoiceId: null,
            deletedAt: null,
            isVoided: false
        },
        select: {
            id: true,
            createdAt: true,
            ownerName: true,
            ownerId: true,
            amount: true,
            truckId: true,
            licensePlate: true,
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Total unbilled BOX_TRUCK txs: ${unbilledBoxTrucks.length}`);

    let noOwnerIdCount = 0;
    for (const t of unbilledBoxTrucks) {
        if (!t.ownerId) {
            noOwnerIdCount++;
            console.log(`Missing ownerId -> ownerName: ${t.ownerName}, amount: ${t.amount}, plate: ${t.licensePlate}`);
        }
    }

    console.log(`Total without ownerId: ${noOwnerIdCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
