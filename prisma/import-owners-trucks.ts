import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

const prisma = new PrismaClient();

// Map Thai group names to OwnerGroup enum
function mapGroup(groupName: string): 'FACTORY' | 'GENERAL_CREDIT' | 'BOX_TRUCK' | 'OIL_TRUCK_SUPACHAI' {
    if (!groupName) return 'GENERAL_CREDIT';
    if (groupName.includes('โรงงานน้ำตาล')) return 'FACTORY';
    if (groupName.includes('รถตู้ทึบ')) return 'BOX_TRUCK';
    if (groupName.includes('รถน้ำมันศุภชัย')) return 'OIL_TRUCK_SUPACHAI';
    return 'GENERAL_CREDIT';
}

async function importOwners() {
    console.log('🚀 Importing owners...');

    const csvPath = path.join(process.cwd(), '..', 'ข้อมูลในอีกโปรแกรม', 'owners.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
    });

    console.log(`📋 Found ${records.length} owners to import`);

    let imported = 0;
    let skipped = 0;
    const ownerIdMap: Record<string, string> = {}; // old id -> new id

    for (const record of records) {
        try {
            const name = record.name?.trim();
            if (!name) {
                skipped++;
                continue;
            }

            // Check if exists
            const existing = await prisma.owner.findFirst({ where: { name } });
            if (existing) {
                ownerIdMap[record.id] = existing.id;
                skipped++;
                continue;
            }

            const owner = await prisma.owner.create({
                data: {
                    name,
                    phone: record.phone || null,
                    venderCode: record.venderCode || null,
                    groupType: mapGroup(record.group),
                    code: record.code || null,
                }
            });

            ownerIdMap[record.id] = owner.id;
            imported++;
            if (imported % 50 === 0) {
                console.log(`  Imported ${imported} owners...`);
            }
        } catch (error) {
            console.error(`Error importing owner ${record.id}:`, error);
            skipped++;
        }
    }

    console.log(`✅ Imported ${imported} owners`);
    console.log(`⚠️ Skipped ${skipped} records`);

    return ownerIdMap;
}

async function importTrucks(ownerIdMap: Record<string, string>) {
    console.log('\n🚗 Importing trucks...');

    const csvPath = path.join(process.cwd(), '..', 'ข้อมูลในอีกโปรแกรม', 'trucks.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
    });

    console.log(`📋 Found ${records.length} trucks to import`);

    let imported = 0;
    let skipped = 0;

    for (const record of records) {
        try {
            const licensePlate = record.licensePlate?.trim();
            if (!licensePlate) {
                skipped++;
                continue;
            }

            // Check if exists
            const existing = await prisma.truck.findFirst({ where: { licensePlate } });
            if (existing) {
                skipped++;
                continue;
            }

            const newOwnerId = ownerIdMap[record.ownerId];

            await prisma.truck.create({
                data: {
                    licensePlate,
                    owner: newOwnerId ? { connect: { id: newOwnerId } } : undefined,
                }
            });

            imported++;
        } catch (error) {
            console.error(`Error importing truck ${record.id}:`, error);
            skipped++;
        }
    }

    console.log(`✅ Imported ${imported} trucks`);
    console.log(`⚠️ Skipped ${skipped} records`);
}

async function main() {
    const ownerIdMap = await importOwners();
    await importTrucks(ownerIdMap);

    // Summary
    const ownerCount = await prisma.owner.count();
    const truckCount = await prisma.truck.count();
    console.log(`\n📊 Database now has ${ownerCount} owners and ${truckCount} trucks`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
