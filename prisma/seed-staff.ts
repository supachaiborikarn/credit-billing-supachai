// Script to seed staff users
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-staff.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STAFF_USERS = [
    // Station 1: แท๊งลอยวัชรเกียรติ
    { name: 'วุฒิ', username: 'วุฒิ', stationId: 'station-1' },
    { name: 'หญิง', username: 'หญิง', stationId: 'station-1' },
    { name: 'ณัช', username: 'ณัช', stationId: 'station-1' },

    // Station 2: วัชรเกียรติออยล์
    { name: 'โส', username: 'โส', stationId: 'station-2' },
    { name: 'แป้ง', username: 'แป้ง', stationId: 'station-2' },

    // Station 3: พงษ์อนันต์ปิโตรเลียม
    { name: 'ติว', username: 'ติว', stationId: 'station-3' },
    { name: 'ดรีม', username: 'ดรีม', stationId: 'station-3' },
    { name: 'กาย', username: 'กาย', stationId: 'station-3' },

    // Station 4: ศุภชัยบริการ
    { name: 'อ้อม', username: 'อ้อม', stationId: 'station-4' },
    { name: 'ใหม่', username: 'ใหม่', stationId: 'station-4' },
    { name: 'รงค์', username: 'รงค์', stationId: 'station-4' },

    // Station 5: ปั๊มแก๊สพงษ์อนันต์
    { name: 'กุ้ง', username: 'กุ้ง', stationId: 'station-5' },
    { name: 'เล็ก', username: 'เล็ก', stationId: 'station-5' },

    // Station 6: ปั๊มแก๊สศุภชัย
    { name: 'เหน่ง', username: 'เหน่ง', stationId: 'station-6' },
    { name: 'คนอง', username: 'คนอง', stationId: 'station-6' },
];

async function main() {
    console.log('🚀 Starting staff user seeding...\n');

    let created = 0;
    let skipped = 0;

    for (const staff of STAFF_USERS) {
        // Check if user already exists
        const existing = await prisma.user.findUnique({
            where: { username: staff.username }
        });

        if (existing) {
            console.log(`⏭️  Skip: ${staff.name} (already exists)`);
            skipped++;
            continue;
        }

        // Hash password (same as username)
        const hashedPassword = await bcrypt.hash(staff.username, 10);

        // Create user
        await prisma.user.create({
            data: {
                name: staff.name,
                username: staff.username,
                password: hashedPassword,
                role: 'STAFF',
                stationId: staff.stationId,
            }
        });

        console.log(`✅ Created: ${staff.name} (${staff.stationId})`);
        created++;
    }

    console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
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
