import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Create stations
    console.log('Creating stations...');
    const stations = await Promise.all([
        prisma.station.upsert({
            where: { id: 'station-1' },
            update: {},
            create: {
                id: 'station-1',
                name: 'แท๊งลอยวัชรเกียรติ',
                type: 'FULL',
            },
        }),
        prisma.station.upsert({
            where: { id: 'station-2' },
            update: {},
            create: {
                id: 'station-2',
                name: 'วัชรเกียรติออยล์',
                type: 'SIMPLE',
            },
        }),
        prisma.station.upsert({
            where: { id: 'station-3' },
            update: {},
            create: {
                id: 'station-3',
                name: 'พงษ์อนันต์ปิโตรเลียม',
                type: 'SIMPLE',
            },
        }),
        prisma.station.upsert({
            where: { id: 'station-4' },
            update: {},
            create: {
                id: 'station-4',
                name: 'ศุภชัยบริการ',
                type: 'SIMPLE',
            },
        }),
    ]);
    console.log(`✅ Created ${stations.length} stations`);

    // Create admin user
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            name: 'Admin',
            username: 'admin',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log(`✅ Created admin user: ${admin.username}`);

    // Create benz user
    const benzPassword = await bcrypt.hash('5555', 10);
    const benz = await prisma.user.upsert({
        where: { username: 'benz' },
        update: {},
        create: {
            name: 'benz',
            username: 'benz',
            password: benzPassword,
            role: 'ADMIN',
        },
    });
    console.log(`✅ Created user: ${benz.username}`);

    // Import owners from CSV
    console.log('Importing owners...');
    const ownersPath = path.join(__dirname, '../../ข้อมูลในอีกโปรแกรม/owners.csv');
    if (fs.existsSync(ownersPath)) {
        const ownersData = fs.readFileSync(ownersPath, 'utf-8');
        const lines = ownersData.split('\n').slice(1); // Skip header

        let ownersCreated = 0;
        for (const line of lines) {
            if (!line.trim()) continue;
            const [id, name, phone, venderCode, group, code] = line.split(',').map(s => s?.trim().replace(/\r/g, ''));

            if (!name) continue;

            let groupType: 'SUGAR_FACTORY' | 'GENERAL_CREDIT' | 'BOX_TRUCK' | 'OIL_TRUCK' = 'GENERAL_CREDIT';
            if (group === 'โรงงานน้ำตาล') groupType = 'SUGAR_FACTORY';
            else if (group === 'รถตู้ทึบส่งโรงงาน') groupType = 'BOX_TRUCK';
            else if (group === 'รถน้ำมันศุภชัย') groupType = 'OIL_TRUCK';

            try {
                await prisma.owner.create({
                    data: {
                        name,
                        phone: phone || null,
                        venderCode: venderCode || null,
                        groupType,
                        code: code || null,
                    },
                });
                ownersCreated++;
            } catch (e) {
                // Skip duplicates
            }
        }
        console.log(`✅ Imported ${ownersCreated} owners`);
    } else {
        console.log('⚠️ Owners CSV not found, skipping import');
    }

    // Import trucks from CSV
    console.log('Importing trucks...');
    const trucksPath = path.join(__dirname, '../../ข้อมูลในอีกโปรแกรม/trucks.csv');
    if (fs.existsSync(trucksPath)) {
        const trucksData = fs.readFileSync(trucksPath, 'utf-8');
        const lines = trucksData.split('\n').slice(1);

        // Get all owners for mapping
        const owners = await prisma.owner.findMany();
        const ownerMap = new Map(owners.map((o, i) => [String(i + 1), o.id]));

        let trucksCreated = 0;
        for (const line of lines) {
            if (!line.trim()) continue;
            const [id, licensePlate, ownerId] = line.split(',').map(s => s?.trim().replace(/\r/g, ''));

            if (!licensePlate) continue;

            const mappedOwnerId = ownerMap.get(ownerId);
            if (!mappedOwnerId) continue;

            try {
                await prisma.truck.create({
                    data: {
                        licensePlate,
                        ownerId: mappedOwnerId,
                    },
                });
                trucksCreated++;
            } catch (e) {
                // Skip duplicates
            }
        }
        console.log(`✅ Imported ${trucksCreated} trucks`);
    } else {
        console.log('⚠️ Trucks CSV not found, skipping import');
    }

    console.log('🎉 Seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
