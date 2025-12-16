// Script to add additional customers
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-customers.ts

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Manual customers to add
const MANUAL_CUSTOMERS = [
    'ทีแอนด์โอฟู้ด',
    'กำแพงเพชรแก๊ส',
    'ป.สยาม',
    'ฉ.การช่าง(RCW)',
    'พงษ์ผกาขนส่ง',
];

async function main() {
    console.log('🚀 Starting customer import...\n');

    let created = 0;
    let skipped = 0;

    // 1. Add manual customers
    console.log('📋 Adding manual customers...');
    for (const name of MANUAL_CUSTOMERS) {
        const existing = await prisma.owner.findFirst({
            where: { name: { contains: name, mode: 'insensitive' } }
        });

        if (existing) {
            console.log(`⏭️  Skip: ${name} (exists as: ${existing.name})`);
            skipped++;
        } else {
            await prisma.owner.create({
                data: {
                    name: name,
                    groupType: 'GENERAL_CREDIT',
                }
            });
            console.log(`✅ Created: ${name}`);
            created++;
        }
    }

    // 2. Read CSV file
    console.log('\n📋 Adding customers from CSV...');
    const csvPath = path.join(process.cwd(), 'customer_names.csv');

    if (!fs.existsSync(csvPath)) {
        console.log('❌ CSV file not found');
        return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    for (let i = 1; i < lines.length; i++) { // Skip header
        const name = lines[i].trim();

        if (!name || name.startsWith('สรุป')) {
            // Skip empty or summary lines
            continue;
        }

        // Check for existing (exact or partial match)
        const existing = await prisma.owner.findFirst({
            where: {
                OR: [
                    { name: name },
                    { name: { contains: name.substring(0, Math.min(name.length, 15)), mode: 'insensitive' } }
                ]
            }
        });

        if (existing) {
            // Only log first 20 skips to reduce noise
            if (skipped < 20) {
                console.log(`⏭️  Skip: ${name}`);
            }
            skipped++;
        } else {
            await prisma.owner.create({
                data: {
                    name: name,
                    groupType: 'GENERAL_CREDIT',
                }
            });
            console.log(`✅ Created: ${name}`);
            created++;
        }
    }

    console.log(`\n📊 Summary: ${created} created, ${skipped} skipped (duplicates)`);
    console.log('✨ Done!');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
