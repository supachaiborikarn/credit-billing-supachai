// Script to seed legacy data from JSON export
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-legacy-json.ts

import { PrismaClient, PaymentType, OwnerGroup } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Data file path
const DATA_FILE = path.join(process.cwd(), 'data_export_20251216_163320.json');
const DEFAULT_STATION_ID = 'station-1'; // Assign legacy trucks/transactions to main station

interface LegacyOwner {
    id: number;
    name: string;
    phone: string;
    venderCode: string;
    group: string;
}

interface LegacyTruck {
    id: number;
    ownerId: number;
    licensePlate: string;
    year: number;
    code: string;
}

interface LegacyTransaction {
    id: number;
    date: string;
    truckId: number | null;
    truckPlate: string;
    paymentType: string;
    amount: number;
    details: {
        liters: number;
        pricePerLiter: number;
        nozzle: number;
    };
}

interface LegacyData {
    owners: LegacyOwner[];
    trucks: LegacyTruck[];
    transactions: LegacyTransaction[];
}

function mapOwnerGroup(groupName: string): OwnerGroup {
    if (groupName.includes('โรงงานน้ำตาล')) return 'SUGAR_FACTORY';
    if (groupName.includes('รถตู้ทึบ')) return 'BOX_TRUCK';
    if (groupName.includes('รถน้ำมัน')) return 'OIL_TRUCK';
    return 'GENERAL_CREDIT';
}

function mapPaymentType(type: string): PaymentType {
    if (type === 'CASH') return 'CASH';
    if (type === 'TRANSFER') return 'TRANSFER';
    return 'CREDIT';
}

async function main() {
    console.log('🚀 Starting legacy data import...');

    // 1. Read JSON file
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Data file not found: ${DATA_FILE}`);
        process.exit(1);
    }
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const data: LegacyData = JSON.parse(rawData);

    console.log(`📊 Found: ${data.owners.length} owners, ${data.trucks.length} trucks, ${data.transactions.length} transactions`);

    // 2. Get Admin User for recordedBy
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
    });

    if (!admin) {
        console.error('❌ No admin user found. Please create an admin user first.');
        process.exit(1);
    }
    console.log(`👤 Using admin: ${admin.name} (${admin.id})`);

    // Maps for legacy ID -> UUID
    const ownerMap = new Map<number, string>(); // Legacy ID -> UUID
    const truckMap = new Map<number, string>(); // Legacy ID -> UUID

    // 3. Import Owners
    console.log('\nProcessing Owners...');
    for (const owner of data.owners) {
        // Check if owner already exists by name or venderCode to avoid duplicates?
        // Ideally checking by name might be safer if imports run multiple times, 
        // but for now we assume fresh import or just create new ones.
        // Let's try to match by name first to avoid creating duplicates if run again.

        let dbOwner = await prisma.owner.findFirst({
            where: { name: owner.name }
        });

        if (!dbOwner) {
            dbOwner = await prisma.owner.create({
                data: {
                    name: owner.name,
                    phone: owner.phone || null,
                    venderCode: owner.venderCode || null,
                    groupType: mapOwnerGroup(owner.group),
                    // We'll update 'code' later from trucks if needed, or leave null for now
                }
            });
        }

        ownerMap.set(owner.id, dbOwner.id);
    }
    console.log(`✅ Processed ${ownerMap.size} owners`);

    // 4. Import Trucks
    console.log('\nProcessing Trucks...');
    let truckCount = 0;
    for (const truck of data.trucks) {
        const ownerId = ownerMap.get(truck.ownerId);
        if (!ownerId) {
            console.warn(`⚠️ Truck ${truck.licensePlate} skipped: Owner ID ${truck.ownerId} not found`);
            continue;
        }

        // Check for duplicate truck
        let dbTruck = await prisma.truck.findFirst({
            where: {
                licensePlate: truck.licensePlate,
                ownerId: ownerId
            }
        });

        if (!dbTruck) {
            dbTruck = await prisma.truck.create({
                data: {
                    licensePlate: truck.licensePlate,
                    ownerId: ownerId,
                }
            });
            truckCount++;
        }

        truckMap.set(truck.id, dbTruck.id);

        // Update Owner code if present in truck and owner has no code
        if (truck.code) {
            const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
            if (owner && !owner.code) {
                await prisma.owner.update({
                    where: { id: ownerId },
                    data: { code: truck.code }
                });
            }
        }
    }
    console.log(`✅ Created ${truckCount} new trucks`);

    // 5. Import Transactions
    console.log('\nProcessing Transactions...');
    let txCount = 0;
    for (const tx of data.transactions) {
        // Resolve references
        let truckId = null;
        let ownerId = null;
        let ownerName = null;
        let licensePlate = tx.truckPlate; // Default to raw plate

        if (tx.truckId) {
            // If linked to a truck
            const mappedTruckId = truckMap.get(tx.truckId);
            if (mappedTruckId) {
                truckId = mappedTruckId;
                // Get owner from truck
                const truck = await prisma.truck.findUnique({
                    where: { id: mappedTruckId },
                    include: { owner: true }
                });
                if (truck) {
                    licensePlate = truck.licensePlate;
                    ownerId = truck.ownerId;
                    ownerName = truck.owner.name;
                }
            }
        }

        // If no truck link but maybe we can match by plate string??
        // For now, trust the data. If truckId is null, it's "รถนอก" usually.

        // Check for duplicate transaction (by date + amount + plate)?
        // Just create new ones since we don't have a unique ID that matches directly across systems easily 
        // without legacy ID field. But we risk duplication if run twice.
        // We'll trust the process is run once or DB is empty.

        await prisma.transaction.create({
            data: {
                stationId: DEFAULT_STATION_ID,
                date: new Date(tx.date),
                truckId: truckId,
                licensePlate: licensePlate,
                ownerId: ownerId,
                ownerName: ownerName || 'ลูกค้าเงินสด/ทั่วไป',
                paymentType: mapPaymentType(tx.paymentType),
                nozzleNumber: tx.details.nozzle || 1,
                liters: tx.details.liters || 0,
                pricePerLiter: tx.details.pricePerLiter || 0,
                amount: tx.amount,
                productType: 'ดีเซล', // Defaulting as not in top-level, assume Diesel for trucks usually
                recordedById: admin.id,
                notes: 'Legacy Data Import'
            }
        });
        txCount++;
    }
    console.log(`✅ Imported ${txCount} transactions`);
    console.log('\n✨ Import completed successfully!');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
