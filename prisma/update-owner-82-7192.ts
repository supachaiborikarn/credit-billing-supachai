const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateOwner() {
    // Data from รถร่วมปรับปรุง.csv
    const ownerData = {
        name: 'นายบุญเลิศ  เหมือนอินทร์',
        phone: null,
        venderCode: '40001673',
        code: 'C172',
    };

    const truckData = {
        licensePlate: 'กพ82-7192',
        code: 'C172',
    };

    console.log('=== Updating Owner & Truck ===');
    console.log('Owner:', ownerData.name);
    console.log('Truck:', truckData.licensePlate);
    console.log('C-Code:', truckData.code);

    // 1. Find or create owner
    let owner = await prisma.owner.findFirst({
        where: {
            OR: [
                { name: { contains: 'บุญเลิศ' } },
                { venderCode: '40001673' }
            ]
        }
    });

    if (!owner) {
        owner = await prisma.owner.create({
            data: {
                name: ownerData.name,
                phone: ownerData.phone,
                venderCode: ownerData.venderCode,
                code: ownerData.code,
                groupType: 'SUGAR_FACTORY',
            }
        });
        console.log('\n✅ Created new owner:', owner.id);
    } else {
        // Update code if missing
        if (!owner.code) {
            owner = await prisma.owner.update({
                where: { id: owner.id },
                data: { code: ownerData.code }
            });
            console.log('\n✅ Updated owner code');
        }
        console.log('\n✅ Found existing owner:', owner.id);
    }

    // 2. Find or create truck
    let truck = await prisma.truck.findFirst({
        where: {
            OR: [
                { licensePlate: 'กพ82-7192' },
                { licensePlate: '82-7192' },
            ]
        }
    });

    if (!truck) {
        truck = await prisma.truck.create({
            data: {
                licensePlate: truckData.licensePlate,
                ownerId: owner.id,
                code: truckData.code,
            }
        });
        console.log('✅ Created new truck:', truck.id);
    } else {
        // Update code and owner if needed
        truck = await prisma.truck.update({
            where: { id: truck.id },
            data: {
                code: truckData.code,
                ownerId: owner.id,
            }
        });
        console.log('✅ Updated truck:', truck.id);
    }

    // 3. Update yesterday's transactions
    const yesterday = new Date('2025-12-24T00:00:00+07:00');
    const today = new Date('2025-12-25T00:00:00+07:00');

    const updated = await prisma.transaction.updateMany({
        where: {
            licensePlate: { contains: '82-7192' },
            date: { gte: yesterday, lt: today },
            deletedAt: null,
        },
        data: {
            ownerId: owner.id,
            ownerName: owner.name,
            truckId: truck.id,
        }
    });

    console.log(`\n✅ Updated ${updated.count} transactions`);

    // Verify
    const txns = await prisma.transaction.findMany({
        where: {
            licensePlate: { contains: '82-7192' },
            date: { gte: yesterday, lt: today },
        },
        include: {
            owner: { select: { name: true, code: true } },
            truck: { select: { licensePlate: true, code: true } },
        }
    });

    console.log('\n=== Verification ===');
    txns.forEach((t: any) => {
        console.log(`- ${t.licensePlate}: Owner=${t.owner?.name}, C-Code=${t.truck?.code}`);
    });

    await prisma.$disconnect();
}

updateOwner();
