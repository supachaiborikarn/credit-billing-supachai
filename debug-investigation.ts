
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Investigation Start ---');

    // 1. Investigating "Em" (เอ็ม) Invoice Issue
    console.log('\n--- 1. Invoice Issue: Owner "Em" ---');
    const ownerName = 'เอ็ม';
    const owners = await prisma.owner.findMany({
        where: { name: { contains: ownerName } },
        include: {
            transactions: {
                // Look for transactions around the 16th of current passing months
                where: {
                    date: {
                        gte: new Date('2024-01-01'), // Broad range to catch recent
                    }
                },
                orderBy: { date: 'desc' },
                take: 20
            }
        }
    });

    if (owners.length === 0) {
        console.log('No owner found matching "เอ็ม"');
    } else {
        for (const owner of owners) {
            console.log(`Owner: ${owner.name} (${owner.id})`);
            // Group by date (DD) to find the "16th" with 3 transactions
            const txByDate: Record<string, any[]> = {};
            owner.transactions.forEach(t => {
                const day = new Date(t.date).getDate();
                const key = `${new Date(t.date).toISOString().split('T')[0]}`; // YYYY-MM-DD
                if (!txByDate[key]) txByDate[key] = [];
                txByDate[key].push(t);
            });

            // Check specifically for date 16th
            Object.keys(txByDate).forEach(dateStr => {
                const day = new Date(dateStr).getDate();
                if (day === 16) {
                    console.log(`  Date: ${dateStr} - Total Transactions: ${txByDate[dateStr].length}`);
                    txByDate[dateStr].forEach(t => {
                        console.log(`    - [${t.paymentType}] ${t.amount} THB (Plate: ${t.licensePlate}) InvoiceId: ${t.invoiceId}`);
                    });
                }
            });
        }
    }

    // 2. Investigating Duplicate Transactions
    console.log('\n--- 2. Duplicate Transactions Check ---');
    // We can't do complex grouping in Prisma easily for strict duplicates, so we'll fetch recent ones and check in memory
    // or assume the user means "same details".
    const recentTx = await prisma.transaction.findMany({
        take: 1000,
        orderBy: { createdAt: 'desc' }
    });

    // Check for duplicates in memory (same station, date, amount, plate, type)
    const txMap = new Map<string, number>();
    let dupCount = 0;

    // Simplistic check: same amount, plate, and date (roughly)
    const potentialDupes: any[] = [];

    // Let's use a SQL query for a better check if possible, creates a more robust check in JS
    // Group by key fields
    const groups: Record<string, any[]> = {};
    recentTx.forEach(t => {
        const key = `${t.stationId}|${t.date.toISOString().split('T')[0]}|${t.licensePlate}|${t.amount}|${t.paymentType}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });

    Object.entries(groups).forEach(([key, items]) => {
        if (items.length > 1) {
            console.log(`Potential Duplicate Group (${items.length} items): ${key}`);
            items.forEach(t => console.log(`  - ID: ${t.id}, CreatedAt: ${t.createdAt}`));
            dupCount++;
        }
    });
    if (dupCount === 0) console.log('No obvious duplicates found in recent 1000 transactions.');


    // 3. Investigating Duplicate Trucks
    console.log('\n--- 3. Duplicate Trucks Check ---');
    const trucks = await prisma.truck.findMany();
    const plateMap: Record<string, any[]> = {};

    trucks.forEach(t => {
        const plate = t.licensePlate.trim();
        if (!plateMap[plate]) plateMap[plate] = [];
        plateMap[plate].push(t);
    });

    let dupTruckCount = 0;
    Object.entries(plateMap).forEach(([plate, items]) => {
        if (items.length > 1) {
            // Only log first 5 duplicates to save space
            if (dupTruckCount < 5) {
                console.log(`Duplicate License Plate: "${plate}" - Count: ${items.length}`);
                const sameOwner = items.every(i => i.ownerId === items[0].ownerId);
                console.log(`  - Same Owner? ${sameOwner}`);
            }
            dupTruckCount++;
        }
    });
    console.log(`Total duplicate plates found: ${dupTruckCount}`);

    console.log('--- Investigation End ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
