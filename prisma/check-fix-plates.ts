const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndFix() {
    console.log('=== 1. ตรวจสอบทะเบียนที่มี C-Code ปน ===\n');

    // Find license plates with C-Code pattern
    const trucksWithCode = await prisma.truck.findMany({
        where: {
            licensePlate: { contains: 'C' }
        },
        include: { owner: { select: { name: true } } }
    });

    console.log('Trucks with C in plate:');
    trucksWithCode.forEach((t: any) => {
        console.log(`- ${t.licensePlate} | Owner: ${t.owner?.name} | Code: ${t.code}`);
    });

    // Check transactions with C in plate
    const txnsWithCode = await prisma.transaction.findMany({
        where: {
            licensePlate: { contains: ' C' },
            deletedAt: null,
        },
        take: 20,
        orderBy: { date: 'desc' },
        select: { id: true, licensePlate: true, ownerName: true, date: true }
    });

    console.log('\nTransactions with C in plate:');
    txnsWithCode.forEach((t: any) => {
        console.log(`- ${t.licensePlate} | Owner: ${t.ownerName} | Date: ${t.date.toISOString().split('T')[0]}`);
    });

    console.log('\n=== 2. อัปเดต บธ-964 → ประสิทธิ์ นาคสุข ===\n');

    // Find ประสิทธิ์ นาคสุข owner
    const prasit = await prisma.owner.findFirst({
        where: { name: { contains: 'ประสิทธิ์' } }
    });

    if (!prasit) {
        console.log('❌ ไม่พบ ประสิทธิ์ นาคสุข ในระบบ');
        await prisma.$disconnect();
        return;
    }

    console.log('Owner found:', prasit.name, 'ID:', prasit.id);

    // Find or create truck บธ-964
    let truck = await prisma.truck.findFirst({
        where: {
            OR: [
                { licensePlate: 'บธ-964' },
                { licensePlate: 'บธ964' },
            ]
        }
    });

    if (!truck) {
        truck = await prisma.truck.create({
            data: {
                licensePlate: 'บธ-964',
                ownerId: prasit.id,
                code: null, // ไม่มีใน C-Code list
            }
        });
        console.log('✅ Created truck บธ-964');
    } else {
        truck = await prisma.truck.update({
            where: { id: truck.id },
            data: { ownerId: prasit.id }
        });
        console.log('✅ Updated truck บธ-964 → owner:', prasit.name);
    }

    // Update transactions for บธ-964
    const updated = await prisma.transaction.updateMany({
        where: {
            licensePlate: 'บธ-964',
            deletedAt: null,
        },
        data: {
            ownerId: prasit.id,
            ownerName: prasit.name,
            truckId: truck.id,
        }
    });
    console.log(`✅ Updated ${updated.count} transactions`);

    console.log('\n=== 3. ค้นหา ท่าทรายถาวร ในระบบ ===\n');

    const thasai = await prisma.owner.findFirst({
        where: { name: { contains: 'ท่าทราย' } },
        include: { trucks: true }
    });

    if (thasai) {
        console.log('Found:', thasai.name);
        console.log('Trucks:', thasai.trucks.map((t: any) => t.licensePlate));
    } else {
        console.log('❌ ไม่พบ ท่าทรายถาวร - ต้องสร้างใหม่');
    }

    await prisma.$disconnect();
}

checkAndFix();
