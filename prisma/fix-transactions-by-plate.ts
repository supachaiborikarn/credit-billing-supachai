const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

interface CsvRow {
    vender: string;
    name: string;
    type: string;
    code: string;
    plateNumber: string;
    phone: string;
}

function normalizeplate(plate: string): string {
    // Remove spaces, dashes, and convert to lowercase
    return plate.replace(/[\s\-\/]/g, '').toLowerCase();
}

async function fixTransactionsByPlate() {
    console.log('=== FIX TRANSACTIONS BY LICENSE PLATE ===\n');

    // Read CSV file to get plate -> owner name mapping
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1);

    // Create map of normalized plate -> { name, vender, phone, code }
    const plateToData = new Map<string, CsvRow>();
    for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const plateNumber = parts[5]?.trim() || '';
        if (!plateNumber) continue;

        const data: CsvRow = {
            vender: parts[1]?.trim() || '',
            name: parts[2]?.trim() || '',
            type: parts[3]?.trim() || '',
            code: parts[4]?.trim() || '',
            plateNumber: plateNumber,
            phone: parts[6]?.trim() || '',
        };

        // Plates can be "กพ80-4332/กพ83-2193" (พ่วง), split them
        const plates = plateNumber.split('/');
        for (const p of plates) {
            const normalized = normalizeplate(p);
            if (normalized) {
                plateToData.set(normalized, data);
            }
        }
    }

    console.log(`CSV plate mappings: ${plateToData.size}`);

    // Get or create owners based on CSV names
    const ownerNameMap = new Map<string, any>();
    const existingOwners = await prisma.owner.findMany({
        where: { groupType: 'SUGAR_FACTORY' }
    });
    for (const owner of existingOwners) {
        ownerNameMap.set(owner.name.trim().toLowerCase(), owner);
    }
    console.log(`Existing SUGAR_FACTORY owners: ${existingOwners.length}\n`);

    // Get all transactions with licensePlate
    const transactions = await prisma.transaction.findMany({
        where: {
            licensePlate: { not: null },
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        select: {
            id: true,
            licensePlate: true,
            ownerId: true,
            truckId: true,
        }
    });

    console.log(`Processing ${transactions.length} transactions...\n`);

    let matched = 0;
    let ownerFixed = 0;
    let truckLinked = 0;
    let newOwnersCreated = 0;

    for (const tx of transactions) {
        if (!tx.licensePlate) continue;

        // Normalize the plate from transaction
        const normalized = normalizeplate(tx.licensePlate);

        // Also try extracting just the plate part (e.g., from "81-4119 C164")
        const platePart = tx.licensePlate.split(' ')[0];
        const normalizedPart = normalizeplate(platePart);

        // Find match in CSV
        let csvData = plateToData.get(normalized) || plateToData.get(normalizedPart);

        // Try partial match (just the main plate without prefix)
        if (!csvData) {
            for (const [key, data] of plateToData.entries()) {
                if (key.includes(normalizedPart) || normalizedPart.includes(key)) {
                    csvData = data;
                    break;
                }
            }
        }

        if (csvData) {
            matched++;

            // Find or create owner
            const ownerKey = csvData.name.trim().toLowerCase();
            let owner = ownerNameMap.get(ownerKey);

            if (!owner) {
                // Create new owner
                owner = await prisma.owner.create({
                    data: {
                        name: csvData.name.trim(),
                        phone: csvData.phone || null,
                        venderCode: csvData.vender || null,
                        groupType: 'SUGAR_FACTORY',
                    }
                });
                ownerNameMap.set(ownerKey, owner);
                newOwnersCreated++;
                console.log(`Created new owner: ${csvData.name}`);
            }

            // Check if owner needs to be updated
            if (tx.ownerId !== owner.id) {
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { ownerId: owner.id }
                });
                ownerFixed++;
            }

            // Find or create truck and link
            if (!tx.truckId) {
                let truck = await prisma.truck.findFirst({
                    where: {
                        licensePlate: { contains: platePart },
                        ownerId: owner.id
                    }
                });

                if (!truck) {
                    truck = await prisma.truck.findFirst({
                        where: { licensePlate: { contains: platePart } }
                    });
                }

                if (truck) {
                    await prisma.transaction.update({
                        where: { id: tx.id },
                        data: { truckId: truck.id }
                    });
                    truckLinked++;
                }
            }
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Transactions processed: ${transactions.length}`);
    console.log(`Matched with CSV: ${matched}`);
    console.log(`Owner IDs fixed: ${ownerFixed}`);
    console.log(`Trucks linked: ${truckLinked}`);
    console.log(`New owners created: ${newOwnersCreated}`);

    // Final count
    const finalOwners = await prisma.owner.count({ where: { groupType: 'SUGAR_FACTORY' } });
    console.log(`\nFinal SUGAR_FACTORY owner count: ${finalOwners}`);

    await prisma.$disconnect();
}

fixTransactionsByPlate().catch(console.error);
