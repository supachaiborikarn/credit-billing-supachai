import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addMissingTransaction() {
    console.log('=== Adding missing transaction Bill 35707 ===\n');

    // 1. First find owner "มณีรัตน์ ศรีสะอาด"
    const owner = await prisma.owner.findFirst({
        where: {
            name: { contains: 'มณีรัตน์' },
            deletedAt: null
        }
    });

    console.log('Found owner:', owner);

    // 2. Find truck with plate 81-4165
    const truck = await prisma.truck.findFirst({
        where: {
            licensePlate: { contains: '81-4165' }
        }
    });
    console.log('Found truck:', truck);

    // 3. Get admin user for recordedById
    const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
    });
    console.log('Admin user:', admin?.id);

    // 4. Check if bill 35707 already exists (double check)
    const existing = await prisma.transaction.findFirst({
        where: {
            stationId: 'station-1',
            billBookNo: '715',
            billNo: '35707'
        }
    });

    if (existing) {
        console.log('❌ Bill 35707 already exists! Aborting.');
        console.log(existing);
        await prisma.$disconnect();
        return;
    }

    // 5. Create the missing transaction
    // Date: 19 December 2024 (วันที่ 19 ธันวาคม)
    const transactionDate = new Date('2024-12-19T12:00:00+07:00');

    const newTx = await prisma.transaction.create({
        data: {
            stationId: 'station-1',
            date: transactionDate,
            licensePlate: 'กพ81-4165',  // Use full plate format like others
            ownerName: 'น.ส.มณีรัตน์  ศรีสะอาด',
            ownerId: owner?.id || null,
            truckId: truck?.id || null,
            paymentType: 'CREDIT',
            liters: 200,
            pricePerLiter: 31.34,
            amount: 6268,
            billBookNo: '715',
            billNo: '35707',
            productType: 'DIESEL',
            recordedById: admin!.id,
        }
    });

    console.log('\n✅ Transaction created successfully!');
    console.log('ID:', newTx.id);
    console.log('Date:', newTx.date);
    console.log('Plate:', newTx.licensePlate);
    console.log('Owner:', newTx.ownerName);
    console.log('Amount:', newTx.amount);
    console.log('Bill:', newTx.billBookNo + '/' + newTx.billNo);

    await prisma.$disconnect();
}

addMissingTransaction();
