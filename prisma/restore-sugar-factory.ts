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

async function restoreSugarFactoryFromCSV() {
    console.log('=== RESTORE SUGAR_FACTORY FROM CSV ===\n');
    console.log('C-code ใน CSV ผูกกับ TRUCK (ทะเบียนรถ) ไม่ใช่ OWNER (เจ้าของ)\n');

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1); // Skip header

    const csvData: CsvRow[] = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const vender = parts[1]?.trim() || '';
        const name = parts[2]?.trim() || '';
        const type = parts[3]?.trim() || '';
        const code = parts[4]?.trim() || '';
        const plateNumber = parts[5]?.trim() || '';
        const phone = parts[6]?.trim() || '';

        if (code && code.startsWith('C')) {
            csvData.push({ vender, name, type, code, plateNumber, phone });
        }
    }

    console.log(`Found ${csvData.length} C-code entries in CSV\n`);

    // Get unique owner names from CSV
    const uniqueOwnerNames = new Set(csvData.map(row => row.name.trim().toLowerCase()));
    console.log(`Unique owner names in CSV: ${uniqueOwnerNames.size}`);

    // Get existing SUGAR_FACTORY owners with transactions
    const existingOwners = await prisma.owner.findMany({
        where: { groupType: 'SUGAR_FACTORY' },
        include: {
            trucks: { select: { id: true, licensePlate: true, code: true } },
            transactions: { select: { id: true } }
        }
    });
    console.log(`Existing SUGAR_FACTORY owners: ${existingOwners.length}`);

    // Also get all existing trucks
    const existingTrucks = await prisma.truck.findMany({
        include: { owner: { select: { groupType: true } } }
    });
    console.log(`Existing trucks total: ${existingTrucks.length}\n`);

    // Create a map of owner name -> owner (to reuse existing owners)
    const ownerNameMap = new Map<string, any>();
    for (const owner of existingOwners) {
        const key = owner.name.trim().toLowerCase();
        // If multiple owners with same name, keep the one with most transactions
        const existing = ownerNameMap.get(key);
        if (!existing || owner.transactions.length > existing.transactions.length) {
            ownerNameMap.set(key, owner);
        }
    }

    // Create a map of license plate -> truck
    const plateToTruck = new Map<string, any>();
    for (const truck of existingTrucks) {
        if (truck.licensePlate) {
            plateToTruck.set(truck.licensePlate.toLowerCase(), truck);
        }
    }

    let ownersCreated = 0;
    let trucksCreated = 0;
    let trucksUpdated = 0;

    for (const row of csvData) {
        const ownerKey = row.name.trim().toLowerCase();
        let owner = ownerNameMap.get(ownerKey);

        // Create owner if doesn't exist
        if (!owner) {
            owner = await prisma.owner.create({
                data: {
                    name: row.name.trim(),
                    phone: row.phone || null,
                    venderCode: row.vender || null,
                    groupType: 'SUGAR_FACTORY',
                    code: null, // C-code is on truck, not owner
                }
            });
            ownerNameMap.set(ownerKey, owner);
            ownersCreated++;
        }

        // Check for existing truck with this license plate
        const plateKey = row.plateNumber.toLowerCase();
        let truck = plateToTruck.get(plateKey);

        if (truck) {
            // Update truck with correct C-code if different
            if (truck.code !== row.code) {
                await prisma.truck.update({
                    where: { id: truck.id },
                    data: { code: row.code, ownerId: owner.id }
                });
                trucksUpdated++;
            }
        } else if (row.plateNumber) {
            // Create new truck
            truck = await prisma.truck.create({
                data: {
                    licensePlate: row.plateNumber,
                    code: row.code,
                    ownerId: owner.id,
                }
            });
            plateToTruck.set(plateKey, truck);
            trucksCreated++;
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Owners created: ${ownersCreated}`);
    console.log(`Trucks created: ${trucksCreated}`);
    console.log(`Trucks updated (C-code): ${trucksUpdated}`);

    // Final counts
    const finalOwners = await prisma.owner.count({ where: { groupType: 'SUGAR_FACTORY' } });
    const finalTrucks = await prisma.truck.count({
        where: { owner: { groupType: 'SUGAR_FACTORY' } }
    });
    console.log(`\nFinal SUGAR_FACTORY owners: ${finalOwners}`);
    console.log(`Final SUGAR_FACTORY trucks: ${finalTrucks}`);

    await prisma.$disconnect();
}

restoreSugarFactoryFromCSV().catch(console.error);
