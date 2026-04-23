import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { STATIONS } from '../src/constants';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const prisma = new PrismaClient();

async function main() {
    const gasStations = STATIONS.filter((station) => station.type === 'GAS');

    for (const station of gasStations) {
        await prisma.station.upsert({
            where: { id: station.id },
            update: {
                name: station.name,
                type: 'GAS',
                hasProducts: 'hasProducts' in station && station.hasProducts === true,
            },
            create: {
                id: station.id,
                name: station.name,
                type: 'GAS',
                hasProducts: 'hasProducts' in station && station.hasProducts === true,
                gasPrice: 16.09,
                gasStockAlert: 1000,
            },
        });
    }

    const rows = await prisma.station.findMany({
        where: { id: { in: gasStations.map((station) => station.id) } },
        select: { id: true, name: true, hasProducts: true },
        orderBy: { id: 'asc' },
    });

    console.log(JSON.stringify({ synced: rows }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
