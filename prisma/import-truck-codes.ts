/**
 * Import C-Code from คลีน_6869.csv to Truck table
 * Each truck gets its own C-Code (1 plate = 1 code)
 * 
 * Run: npx tsx prisma/import-truck-codes.ts
 */

import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';

interface CSVRow {
    code: string;
    licensePlate: string;
    ownerName: string;
}

async function main() {
    console.log('🚀 Starting C-Code import from CSV...\n');

    // Read CSV file
    const csvPath = 'คลีน_6869.csv';
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ File not found: ${csvPath}`);
        process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header

    const csvData: CSVRow[] = [];

    for (const line of lines) {
        const cols = line.split(',');
        if (cols.length >= 6) {
            const code = cols[4]?.trim();
            const plates = cols[5]?.trim();
            const ownerName = cols[2]?.trim();

            if (code && plates && ownerName) {
                // Split multiple plates (e.g. กพ80-4332/กพ83-2193)
                const plateList = plates.split('/');
                for (const p of plateList) {
                    csvData.push({
                        code: code.toUpperCase(),
                        licensePlate: p.trim(),
                        ownerName
                    });
                }
            }
        }
    }

    console.log(`📋 Found ${csvData.length} plate-to-code mappings in CSV\n`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const row of csvData) {
        try {
            // Find truck by license plate (partial match)
            const truck = await prisma.truck.findFirst({
                where: {
                    licensePlate: { contains: row.licensePlate.replace('กพ', '') }
                }
            });

            if (truck) {
                // Update truck with C-Code
                await prisma.truck.update({
                    where: { id: truck.id },
                    data: { code: row.code }
                });
                updated++;
                if (updated <= 5) {
                    console.log(`✅ ${truck.licensePlate} -> ${row.code}`);
                }
            } else {
                notFound++;
                if (notFound <= 5) {
                    console.log(`⚠️  Not found: ${row.licensePlate} (${row.code})`);
                }
            }
        } catch (error) {
            errors++;
            console.error(`❌ Error updating ${row.licensePlate}:`, error);
        }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Not found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);

    // Verify the problematic record
    console.log('\n🔍 Verifying กพ83-4026:');
    const testTruck = await prisma.truck.findFirst({
        where: { licensePlate: { contains: '4026' } },
        include: { owner: { select: { name: true, code: true } } }
    });
    if (testTruck) {
        console.log(`   Plate: ${testTruck.licensePlate}`);
        console.log(`   Truck Code: ${testTruck.code || 'NONE'}`);
        console.log(`   Owner Code: ${testTruck.owner?.code || 'NONE'}`);
        console.log(`   Owner Name: ${testTruck.owner?.name || 'NONE'}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
