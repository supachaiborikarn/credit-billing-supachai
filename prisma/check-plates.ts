const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const plates = ['82-0132', '82-6000', '80-1278'];

    console.log('Checking trucks for plates:', plates);

    for (const plate of plates) {
        // Try exact match
        let truck = await prisma.truck.findFirst({
            where: { licensePlate: plate },
            select: { licensePlate: true, code: true }
        });

        if (!truck) {
            // Try with กพ prefix
            const searchPlate = 'กพ' + plate.replace('-', '');
            truck = await prisma.truck.findFirst({
                where: { licensePlate: searchPlate },
                select: { licensePlate: true, code: true }
            });
        }

        if (!truck) {
            // Try fuzzy match
            const digits = plate.split('-')[1];
            const trucks = await prisma.truck.findMany({
                where: { licensePlate: { contains: digits } },
                select: { licensePlate: true, code: true },
                take: 3
            });
            if (trucks.length > 0) {
                console.log(plate, '-> Possible matches:');
                trucks.forEach((t: { licensePlate: string; code: string | null }) =>
                    console.log('   ', t.licensePlate, '=', t.code)
                );
                continue;
            }
        }

        console.log(plate, '->', truck ? `${truck.licensePlate} = ${truck.code}` : 'NOT FOUND');
    }

    await prisma.$disconnect();
}

check();
