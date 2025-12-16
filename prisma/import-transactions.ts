import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

const prisma = new PrismaClient();

async function importTransactions() {
    console.log('🚀 Importing transactions...');

    // Get the first station (แท๊งลอยวัชรเกียรติ)
    const station = await prisma.station.findFirst();
    if (!station) {
        console.error('❌ No station found. Run seed first.');
        return;
    }

    // Get admin user for recordedBy
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (!adminUser) {
        console.error('❌ No admin user found. Run seed first.');
        return;
    }

    // Get all trucks for lookup
    const trucks = await prisma.truck.findMany({
        include: { owner: true }
    });
    const truckMap = new Map(trucks.map(t => [t.licensePlate, t]));

    // Read CSV
    const csvPath = path.join(process.cwd(), '..', 'ข้อมูลในอีกโปรแกรม', 'transactions.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
    });

    console.log(`📋 Found ${records.length} transactions to import`);

    let imported = 0;
    let skipped = 0;

    for (const record of records) {
        try {
            // Parse date
            const date = new Date(record.date);
            if (isNaN(date.getTime())) {
                skipped++;
                continue;
            }

            // Find truck if available
            const truck = record.truckPlate && record.truckPlate !== 'รถนอก'
                ? truckMap.get(record.truckPlate)
                : null;

            // Map payment type
            const paymentTypeMap: Record<string, string> = {
                'CASH': 'CASH',
                'CREDIT': 'CREDIT',
                'TRANSFER': 'TRANSFER',
                'BOX_TRUCK': 'BOX_TRUCK',
                'OIL_TRUCK_SUPACHAI': 'OIL_TRUCK_SUPACHAI',
            };
            const paymentType = paymentTypeMap[record.paymentType] || 'CASH';

            // Create transaction
            await prisma.transaction.create({
                data: {
                    station: { connect: { id: station.id } },
                    recordedBy: { connect: { id: adminUser.id } },
                    date,
                    licensePlate: record.truckPlate || 'รถนอก',
                    ownerName: truck?.owner?.name || '',
                    owner: truck?.owner?.id ? { connect: { id: truck.owner.id } } : undefined,
                    truck: truck?.id ? { connect: { id: truck.id } } : undefined,
                    paymentType: paymentType as any,
                    liters: parseFloat(record.liters) || 0,
                    pricePerLiter: parseFloat(record.pricePerLiter) || 30.5,
                    amount: parseFloat(record.amount) || 0,
                    nozzleNumber: null,
                    notes: record.notes || null,
                }
            });

            imported++;
            if (imported % 50 === 0) {
                console.log(`  Imported ${imported} transactions...`);
            }
        } catch (error) {
            console.error(`Error importing record ${record.id}:`, error);
            skipped++;
        }
    }

    console.log(`✅ Imported ${imported} transactions`);
    console.log(`⚠️ Skipped ${skipped} records`);
}

importTransactions()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
