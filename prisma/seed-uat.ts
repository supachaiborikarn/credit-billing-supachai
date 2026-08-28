import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const CONFIRMATION = 'YES_I_KNOW_THIS_IS_UAT';

function assertUatSeedSafety() {
    const databaseUrl = process.env.DATABASE_URL || '';
    const uatDatabaseUrl = process.env.UAT_DATABASE_URL || '';
    if (process.env.UAT_WRITE_ENABLED !== CONFIRMATION) {
        throw new Error(`Refusing UAT seed: UAT_WRITE_ENABLED must equal ${CONFIRMATION}`);
    }
    if (!databaseUrl || !uatDatabaseUrl || databaseUrl !== uatDatabaseUrl) {
        throw new Error('Refusing UAT seed: DATABASE_URL must be the validated UAT_DATABASE_URL');
    }
    const password = process.env.UAT_ADMIN_PASSWORD || '';
    if (password.length < 8) {
        throw new Error('Refusing UAT seed: UAT_ADMIN_PASSWORD must be at least 8 characters');
    }
    return password;
}

const adminPassword = assertUatSeedSafety();
const staffPassword = process.env.UAT_STAFF_PASSWORD || adminPassword;
const prisma = new PrismaClient();

const stations = [
    { id: 'station-1', name: 'แท๊งลอยวัชรเกียรติ', type: 'FULL' as const, hasProducts: false, gasPrice: null },
    { id: 'station-2', name: 'วัชรเกียรติออยล์', type: 'SIMPLE' as const, hasProducts: false, gasPrice: null },
    { id: 'station-3', name: 'พงษ์อนันต์ปิโตรเลียม', type: 'SIMPLE' as const, hasProducts: false, gasPrice: null },
    { id: 'station-4', name: 'ศุภชัยบริการ', type: 'SIMPLE' as const, hasProducts: false, gasPrice: null },
    { id: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์', type: 'GAS' as const, hasProducts: true, gasPrice: 16.09 },
    { id: 'station-6', name: 'ปั๊มแก๊สศุภชัย', type: 'GAS' as const, hasProducts: false, gasPrice: 16.09 },
];

async function main() {
    console.log('Seeding isolated CreditBilling UAT fixtures...');

    for (const station of stations) {
        await prisma.station.upsert({
            where: { id: station.id },
            update: {
                name: station.name,
                type: station.type,
                hasProducts: station.hasProducts,
                gasPrice: station.gasPrice,
                gasStockAlert: station.type === 'GAS' ? 20 : null,
                gasInitialStock: station.type === 'GAS' ? 10000 : 0,
            },
            create: {
                ...station,
                gasStockAlert: station.type === 'GAS' ? 20 : null,
                gasInitialStock: station.type === 'GAS' ? 10000 : 0,
            },
        });
    }

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const staffHash = await bcrypt.hash(staffPassword, 10);

    await prisma.user.upsert({
        where: { username: 'uat_admin' },
        update: { name: 'UAT Admin', role: 'ADMIN', stationId: null, password: adminHash },
        create: { name: 'UAT Admin', username: 'uat_admin', role: 'ADMIN', stationId: null, password: adminHash },
    });

    for (const stationId of ['station-1', 'station-5', 'station-6'] as const) {
        const username = `uat_${stationId.replace('-', '')}`;
        await prisma.user.upsert({
            where: { username },
            update: { name: `UAT ${stationId}`, role: 'STAFF', stationId, password: staffHash },
            create: { name: `UAT ${stationId}`, username, role: 'STAFF', stationId, password: staffHash },
        });
    }

    const owner = await prisma.owner.upsert({
        where: { id: 'uat-owner-credit' },
        update: {
            name: 'UAT Credit Customer',
            code: 'UAT-001',
            status: 'ACTIVE',
            deletedAt: null,
            creditLimit: 100000,
            currentCredit: 0,
        },
        create: {
            id: 'uat-owner-credit',
            name: 'UAT Credit Customer',
            code: 'UAT-001',
            groupType: 'GENERAL_CREDIT',
            status: 'ACTIVE',
            creditLimit: 100000,
            currentCredit: 0,
        },
    });

    await prisma.truck.upsert({
        where: { id: 'uat-truck-credit' },
        update: { ownerId: owner.id, licensePlate: 'UAT-TEST', deletedAt: null },
        create: { id: 'uat-truck-credit', ownerId: owner.id, licensePlate: 'UAT-TEST', code: 'UAT-TRUCK' },
    });

    const product = await prisma.product.upsert({
        where: { id: 'uat-product-water' },
        update: { name: 'UAT Water', unit: 'bottle', costPrice: 5, salePrice: 10 },
        create: { id: 'uat-product-water', name: 'UAT Water', unit: 'bottle', costPrice: 5, salePrice: 10 },
    });

    await prisma.productInventory.upsert({
        where: { productId_stationId: { productId: product.id, stationId: 'station-5' } },
        update: { quantity: 20, alertLevel: 5 },
        create: { productId: product.id, stationId: 'station-5', quantity: 20, alertLevel: 5 },
    });

    await prisma.gasSettings.upsert({
        where: { key: 'gasPrice' },
        update: { value: '16.09' },
        create: { key: 'gasPrice', value: '16.09' },
    });

    console.log('UAT seed complete: stations 1-6, isolated users, one credit owner/truck, station-5 product inventory.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
