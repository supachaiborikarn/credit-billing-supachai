const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    // Yesterday = 2025-12-24
    const yesterday = new Date('2025-12-24T00:00:00+07:00');
    const today = new Date('2025-12-25T00:00:00+07:00');

    // Find station แท๊งลอย (likely station-6)
    const stations = await prisma.station.findMany({
        where: { type: 'GAS' },
        select: { id: true, name: true }
    });
    console.log('Gas Stations:', JSON.stringify(stations, null, 2));

    // Get all CREDIT transactions from yesterday for gas stations
    const txns = await prisma.transaction.findMany({
        where: {
            paymentType: 'CREDIT',
            date: { gte: yesterday, lt: today },
            stationId: { startsWith: 'station-' },
            deletedAt: null,
        },
        include: {
            owner: { select: { name: true, code: true } },
            truck: { select: { licensePlate: true, code: true } },
            station: { select: { name: true } },
        },
        orderBy: { date: 'asc' }
    });

    console.log('\n=== CREDIT Transactions Yesterday ===');
    console.log('Total:', txns.length);

    // Find transactions without owner name
    const noOwner = txns.filter((t: any) => !t.ownerName && !t.owner?.name);
    console.log('\n=== No Owner Name (but has plate) ===');
    noOwner.forEach((t: any) => {
        console.log(`- Plate: ${t.licensePlate}, Amount: ${t.amount}, Station: ${t.station?.name}`);
    });

    // Find ประสิทธิ์ นาคสุข
    const prasit = txns.filter((t: any) =>
        t.ownerName?.includes('ประสิทธิ์') ||
        t.owner?.name?.includes('ประสิทธิ์')
    );
    console.log('\n=== ประสิทธิ์ นาคสุข ===');
    prasit.forEach((t: any) => {
        console.log(`- Plate: ${t.licensePlate}, Owner: ${t.ownerName || t.owner?.name}, C-Code: ${t.truck?.code || t.owner?.code || 'NONE'}, Amount: ${t.amount}`);
    });

    // Check owner record
    const owner = await prisma.owner.findFirst({
        where: { name: { contains: 'ประสิทธิ์' } },
        include: { trucks: true }
    });
    console.log('\n=== Owner Record for ประสิทธิ์ ===');
    if (owner) {
        console.log('Name:', owner.name);
        console.log('Code:', owner.code || 'NONE');
        console.log('Trucks:', owner.trucks.map((t: any) => `${t.licensePlate} (code: ${t.code || 'NONE'})`));
    } else {
        console.log('Not found in owners table');
    }

    await prisma.$disconnect();
}
check();
