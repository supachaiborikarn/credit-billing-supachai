/**
 * Seed script for Dispensers and Nozzles
 * Run with: npx ts-node prisma/seed-dispensers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fuel product codes - must match existing FuelProduct table
const FUEL_PRODUCTS = {
    DIESEL: 'DIESEL',
    DIESEL_B7: 'DIESEL_B7',
    GASOHOL_95: 'GASOHOL_95',
    GASOHOL_91: 'GASOHOL_91',
    E20: 'E20',
    BENZINE_95: 'BENZINE_95',
    POWER_DIESEL: 'POWER_DIESEL'
};

// Station dispenser configurations
const STATION_CONFIGS: Record<string, Array<{
    code: string;
    nozzles: Array<{ code: string; productCode: string }>;
}>> = {
    // Station 1 - แท๊งลอยวัชรเกียรติ: 4 หัว (ดีเซล B7 ทั้งหมด)
    'station-1': [
        {
            code: 'D1',
            nozzles: [
                { code: 'N1', productCode: FUEL_PRODUCTS.DIESEL_B7 },
                { code: 'N2', productCode: FUEL_PRODUCTS.DIESEL_B7 }
            ]
        },
        {
            code: 'D2',
            nozzles: [
                { code: 'N3', productCode: FUEL_PRODUCTS.DIESEL_B7 },
                { code: 'N4', productCode: FUEL_PRODUCTS.DIESEL_B7 }
            ]
        }
    ],

    // Station 2 - วัชรเกียรติออยล์: 42 หัว
    'station-2': [
        // ดีเซล B7 ตู้ 1-7 (14 หัว)
        ...Array.from({ length: 7 }, (_, i) => ({
            code: `D${i + 1}`,
            nozzles: [
                { code: `N${i * 2 + 1}`, productCode: FUEL_PRODUCTS.DIESEL_B7 },
                { code: `N${i * 2 + 2}`, productCode: FUEL_PRODUCTS.DIESEL_B7 }
            ]
        })),
        // เบนซิน 95 ตู้ 8
        {
            code: 'D8',
            nozzles: [
                { code: 'N15', productCode: FUEL_PRODUCTS.BENZINE_95 },
                { code: 'N16', productCode: FUEL_PRODUCTS.BENZINE_95 }
            ]
        },
        // E20 ตู้ 9-12
        ...Array.from({ length: 4 }, (_, i) => ({
            code: `D${i + 9}`,
            nozzles: [
                { code: `N${i * 2 + 17}`, productCode: FUEL_PRODUCTS.E20 },
                { code: `N${i * 2 + 18}`, productCode: FUEL_PRODUCTS.E20 }
            ]
        })),
        // แก๊สโซฮอล์ 95 ตู้ 13-16
        ...Array.from({ length: 4 }, (_, i) => ({
            code: `D${i + 13}`,
            nozzles: [
                { code: `N${i * 2 + 25}`, productCode: FUEL_PRODUCTS.GASOHOL_95 },
                { code: `N${i * 2 + 26}`, productCode: FUEL_PRODUCTS.GASOHOL_95 }
            ]
        })),
        // แก๊สโซฮอล์ 91 ตู้ 17-20
        ...Array.from({ length: 4 }, (_, i) => ({
            code: `D${i + 17}`,
            nozzles: [
                { code: `N${i * 2 + 33}`, productCode: FUEL_PRODUCTS.GASOHOL_91 },
                { code: `N${i * 2 + 34}`, productCode: FUEL_PRODUCTS.GASOHOL_91 }
            ]
        })),
        // พาวเวอร์ดีเซล ตู้ 21
        {
            code: 'D21',
            nozzles: [
                { code: 'N41', productCode: FUEL_PRODUCTS.POWER_DIESEL },
                { code: 'N42', productCode: FUEL_PRODUCTS.POWER_DIESEL }
            ]
        }
    ],

    // Station 4 - ศุภชัยบริการ (similar config)
    'station-4': [
        // ดีเซล ตู้ 1-10
        ...Array.from({ length: 10 }, (_, i) => ({
            code: `D${i + 1}`,
            nozzles: [
                { code: `N${i * 2 + 1}`, productCode: FUEL_PRODUCTS.DIESEL },
                { code: `N${i * 2 + 2}`, productCode: FUEL_PRODUCTS.DIESEL }
            ]
        })),
        // พาวเวอร์ดีเซล ตู้ 11-13
        ...Array.from({ length: 3 }, (_, i) => ({
            code: `D${i + 11}`,
            nozzles: [
                { code: `N${i * 2 + 21}`, productCode: FUEL_PRODUCTS.POWER_DIESEL },
                { code: `N${i * 2 + 22}`, productCode: FUEL_PRODUCTS.POWER_DIESEL }
            ]
        })),
        // แก๊สโซฮอล์ 95 ตู้ 14-16
        ...Array.from({ length: 3 }, (_, i) => ({
            code: `D${i + 14}`,
            nozzles: [
                { code: `N${i * 2 + 27}`, productCode: FUEL_PRODUCTS.GASOHOL_95 },
                { code: `N${i * 2 + 28}`, productCode: FUEL_PRODUCTS.GASOHOL_95 }
            ]
        })),
        // แก๊สโซฮอล์ 91 ตู้ 17-18
        ...Array.from({ length: 2 }, (_, i) => ({
            code: `D${i + 17}`,
            nozzles: [
                { code: `N${i * 2 + 33}`, productCode: FUEL_PRODUCTS.GASOHOL_91 },
                { code: `N${i * 2 + 34}`, productCode: FUEL_PRODUCTS.GASOHOL_91 }
            ]
        })),
        // เบนซิน 95 ตู้ 19
        {
            code: 'D19',
            nozzles: [
                { code: 'N37', productCode: FUEL_PRODUCTS.BENZINE_95 },
                { code: 'N38', productCode: FUEL_PRODUCTS.BENZINE_95 }
            ]
        },
        // E20 ตู้ 20-21
        ...Array.from({ length: 2 }, (_, i) => ({
            code: `D${i + 20}`,
            nozzles: [
                { code: `N${i * 2 + 39}`, productCode: FUEL_PRODUCTS.E20 },
                { code: `N${i * 2 + 40}`, productCode: FUEL_PRODUCTS.E20 }
            ]
        }))
    ]
};

async function main() {
    console.log('🌱 Starting dispenser seed...');

    // Get all fuel products
    const products = await prisma.fuelProduct.findMany();
    const productMap = Object.fromEntries(products.map(p => [p.code, p.id]));
    console.log(`Found ${products.length} fuel products`);

    // Get all stations
    const stations = await prisma.station.findMany();
    console.log(`Found ${stations.length} stations`);

    for (const station of stations) {
        const config = STATION_CONFIGS[station.id];
        if (!config) {
            console.log(`⏭️ No config for station: ${station.name}`);
            continue;
        }

        console.log(`\n📍 Processing station: ${station.name}`);

        for (const dispenserConfig of config) {
            // Check if dispenser already exists
            const existing = await prisma.dispenser.findFirst({
                where: { stationId: station.id, code: dispenserConfig.code }
            });

            if (existing) {
                console.log(`  ⏭️ Dispenser ${dispenserConfig.code} already exists`);
                continue;
            }

            // Create dispenser with nozzles
            const nozzlesData = dispenserConfig.nozzles
                .filter(n => productMap[n.productCode])
                .map(n => ({
                    code: n.code,
                    productId: productMap[n.productCode]
                }));

            if (nozzlesData.length === 0) {
                console.log(`  ⚠️ No valid products for ${dispenserConfig.code}, skipping`);
                continue;
            }

            await prisma.dispenser.create({
                data: {
                    stationId: station.id,
                    code: dispenserConfig.code,
                    nozzles: {
                        create: nozzlesData
                    }
                }
            });
            console.log(`  ✅ Created ${dispenserConfig.code} with ${nozzlesData.length} nozzles`);
        }
    }

    console.log('\n✅ Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
