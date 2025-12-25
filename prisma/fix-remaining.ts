const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixRemaining() {
    console.log('=== แก้ไขรายการที่เหลือ ===\n');

    // 1. 83-4408 → ศิริมาศ งามประเสริฐ
    console.log('1. 83-4408 → ศิริมาศ งามประเสริฐ\n');

    let sirimat = await prisma.owner.findFirst({
        where: { name: { contains: 'ศิริมาศ' } }
    });

    if (!sirimat) {
        sirimat = await prisma.owner.create({
            data: {
                name: 'น.ส.ศิริมาศ  งามประเสริฐ',
                phone: '064-3514163',
                venderCode: '40002437',
                code: 'C340',
                groupType: 'SUGAR_FACTORY',
            }
        });
        console.log('✅ Created owner: ศิริมาศ งามประเสริฐ');
    }

    // Create/update truck
    let truck = await prisma.truck.findFirst({
        where: { licensePlate: { contains: '83-4408' } }
    });
    if (!truck) {
        truck = await prisma.truck.create({
            data: {
                licensePlate: 'กพ83-4408',
                ownerId: sirimat.id,
                code: 'C340',
            }
        });
        console.log('✅ Created truck: กพ83-4408');
    }

    const u1 = await prisma.transaction.updateMany({
        where: {
            licensePlate: '83-4408',
            paymentType: 'CREDIT',
            OR: [{ ownerName: null }, { ownerName: '' }],
            deletedAt: null,
        },
        data: { ownerName: sirimat.name, ownerId: sirimat.id, truckId: truck.id }
    });
    console.log(`✅ Updated: ${u1.count} transactions`);

    // 2. For remaining, set plate as owner name (they're general credit customers, not sugar factory)
    console.log('\n2. รายการทั่วไป (ไม่ใช่รถร่วม) - ใช้ทะเบียนเป็นชื่อ\n');

    const generalPlates = ['9506', '9592', '0809', 'ป้ายแดง', 'ผต2251', '70-1541', 'บธ4', '70-2082', 'กต 6451'];

    for (const plate of generalPlates) {
        // Find or create as general credit customer
        let owner = await prisma.owner.findFirst({
            where: { name: plate }
        });

        if (!owner) {
            owner = await prisma.owner.create({
                data: {
                    name: plate,
                    groupType: 'GENERAL_CREDIT',
                }
            });
        }

        const u = await prisma.transaction.updateMany({
            where: {
                licensePlate: plate,
                paymentType: 'CREDIT',
                OR: [{ ownerName: null }, { ownerName: '' }],
                deletedAt: null,
            },
            data: { ownerName: plate, ownerId: owner.id }
        });

        if (u.count > 0) {
            console.log(`✅ ${plate}: ${u.count} รายการ`);
        }
    }

    // 3. NO_PLATE → ลูกค้าทั่วไป
    console.log('\n3. ไม่มีทะเบียน → ลูกค้าทั่วไป\n');

    let general = await prisma.owner.findFirst({
        where: { name: 'ลูกค้าทั่วไป' }
    });

    if (!general) {
        general = await prisma.owner.create({
            data: { name: 'ลูกค้าทั่วไป', groupType: 'GENERAL_CREDIT' }
        });
    }

    const noPlate = await prisma.transaction.updateMany({
        where: {
            licensePlate: null,
            paymentType: 'CREDIT',
            OR: [{ ownerName: null }, { ownerName: '' }],
            deletedAt: null,
        },
        data: { ownerName: 'ลูกค้าทั่วไป', ownerId: general.id }
    });
    console.log(`✅ ไม่มีทะเบียน: ${noPlate.count} รายการ`);

    // Final check
    console.log('\n=== ตรวจสอบผลลัพธ์ ===\n');

    const remaining = await prisma.transaction.findMany({
        where: {
            paymentType: 'CREDIT',
            OR: [{ ownerName: null }, { ownerName: '' }],
            deletedAt: null,
        },
        select: { licensePlate: true, amount: true, date: true },
    });

    if (remaining.length === 0) {
        console.log('✅ ไม่มีรายการ CREDIT ที่ไม่มีชื่อเจ้าของแล้ว!');
    } else {
        console.log(`⚠️ ยังเหลือ ${remaining.length} รายการ`);
    }

    await prisma.$disconnect();
}

fixRemaining();
