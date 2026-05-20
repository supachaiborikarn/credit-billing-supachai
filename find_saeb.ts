import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const STATION_ID = 'station-1';
    
    // Find owners
    const owners = await prisma.owner.findMany({
        where: { name: { contains: 'แสบ' } }
    });
    console.log("Owners matching 'แสบ':", owners.map(o => ({ id: o.id, name: o.name })));

    // Find trucks
    const ownerIds = owners.map(o => o.id);
    
    if (ownerIds.length > 0) {
        const trueTrucks = await prisma.truck.findMany({ where: { ownerId: { in: ownerIds } }});
        console.log("Trucks belonging to owners:", trueTrucks.map(t => ({ plate: t.licensePlate })));
    }

    // Attempt to find any transactions in station-1 matching 'แสบ'
    const recentTx = await prisma.transaction.findFirst({
        where: {
            stationId: STATION_ID,
            OR: [
                { ownerName: { contains: 'แสบ' } },
                { truck: { owner: { name: { contains: 'แสบ' } } } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        include: { truck: true }
    });
    
    if (recentTx) {
        console.log("Found recent tx plate:", recentTx.licensePlate, "or truck plate:", recentTx.truck?.licensePlate, "recorded by name:", recentTx.ownerName);
    } else {
        console.log("No transactions found for แสบ directly. Try searching user fullName in the other project.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
