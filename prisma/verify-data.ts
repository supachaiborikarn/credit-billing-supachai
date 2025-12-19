import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log('='.repeat(60));
    console.log('📋 ตรวจสอบ 1: ชื่อ Owner ที่มีคำว่า กำแพงเพชร');
    console.log('='.repeat(60));

    const owners1 = await prisma.owner.findMany({
        where: {
            deletedAt: null,
            name: { contains: 'กำแพงเพชร' }
        },
        select: { id: true, name: true, code: true }
    });

    console.log(`พบ ${owners1.length} รายการ:`);
    owners1.forEach(o => console.log(`   - ${o.name} (code: ${o.code || 'N/A'})`));

    console.log('\n');
    console.log('='.repeat(60));
    console.log('📋 ตรวจสอบ 2: ชื่อ Owner ที่มีคำว่า อีซูซุ');
    console.log('='.repeat(60));

    const owners2 = await prisma.owner.findMany({
        where: {
            deletedAt: null,
            name: { contains: 'อีซูซุ' }
        },
        select: { id: true, name: true, code: true }
    });

    console.log(`พบ ${owners2.length} รายการ:`);
    owners2.forEach(o => console.log(`   - ${o.name} (code: ${o.code || 'N/A'})`));

    console.log('\n');
    console.log('='.repeat(60));
    console.log('📋 ตรวจสอบ 3: Transaction วันนี้ - ชื่อ Owner (Station 4)');
    console.log('='.repeat(60));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrans = await prisma.transaction.findMany({
        where: {
            date: { gte: today },
            stationId: 'station-4'
        },
        select: { ownerName: true },
    });

    const uniqueNames = [...new Set(todayTrans.map(t => t.ownerName).filter(Boolean))];
    console.log(`รายการวันนี้: ${todayTrans.length} transactions`);
    console.log('ชื่อ Owner ที่ไม่ซ้ำ:');
    uniqueNames.sort().forEach(n => console.log(`   - ${n}`));

    console.log('\n');
    console.log('='.repeat(60));
    console.log('📋 ตรวจสอบ 4: ข้อมูลรถร่วม (SUGAR_FACTORY) - ตัวอย่าง 5 รายการ');
    console.log('='.repeat(60));

    const trucks = await prisma.truck.findMany({
        where: {
            owner: {
                groupType: 'SUGAR_FACTORY',
                deletedAt: null
            }
        },
        include: {
            owner: { select: { name: true, code: true } }
        },
        take: 5
    });

    console.log(`ตัวอย่างรถร่วม:`);
    trucks.forEach(t => console.log(`   🚗 ${t.licensePlate} → ${t.owner.name} (${t.owner.code || 'N/A'})`));

    // Count total
    const totalTrucks = await prisma.truck.count({
        where: {
            owner: {
                groupType: 'SUGAR_FACTORY',
                deletedAt: null
            }
        }
    });
    console.log(`\nรวมรถร่วมทั้งหมด: ${totalTrucks} คัน`);

    console.log('\n✅ การตรวจสอบเสร็จสิ้น!');
}

verify()
    .catch((e) => {
        console.error('Error:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
