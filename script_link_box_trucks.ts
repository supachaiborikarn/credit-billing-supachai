import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const unbilledBoxTrucks = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            invoiceId: null,
            deletedAt: null,
            isVoided: false,
            ownerId: null,
            ownerName: { not: null }
        },
        select: {
            id: true,
            ownerName: true
        }
    });

    console.log(`Found ${unbilledBoxTrucks.length} transactions missing ownerId.`);

    let updatedCount = 0;

    // Create a cache to avoid hitting the DB for every transaction
    const ownerCache: Record<string, string> = {};

    for (const t of unbilledBoxTrucks) {
        if (!t.ownerName) continue;

        const name = t.ownerName.trim();

        let ownerId = ownerCache[name];

        if (!ownerId) {
            // Find owner by name (ignoring spaces)
            const owner = await prisma.owner.findFirst({
                where: { name: { contains: name } }
            });

            if (owner) {
                ownerId = owner.id;
                ownerCache[name] = owner.id;
            }
        }

        if (ownerId) {
            await prisma.transaction.update({
                where: { id: t.id },
                data: { ownerId: ownerId }
            });
            updatedCount++;
            console.log(`Linked transaction ${t.id} to owner ${name} (${ownerId})`);
        } else {
            console.log(`Could not find owner for name: ${name}`);
        }
    }

    console.log(`Successfully updated ${updatedCount} transactions.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
