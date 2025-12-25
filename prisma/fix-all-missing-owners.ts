const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllMissingOwners() {
    console.log('=== แก้ไขรายการ CREDIT ที่ไม่มีชื่อเจ้าของ ===\n');

    // Mapping: license plate pattern → owner name lookup
    const plateToOwner: Record<string, string> = {
        'อ.อารยะวงศ์': 'อ.อารยะวงศ์',
        'ท่าทรายถาวร': 'ท่าทรายถาวร',
        // These might need manual review:
        '9506': 'ต้องตรวจสอบ',
        '9592': 'ต้องตรวจสอบ',
        'สต๊อก': 'สต๊อก',
        '0809': 'ต้องตรวจสอบ',
        '83-4408': 'ต้องตรวจสอบ',
        'กต 6451': 'ต้องตรวจสอบ',
        '82-0735': 'ท่าทรายถาวร', // ท่าทรายมีรถนี้
        'ป้ายแดง': 'ต้องตรวจสอบ',
        'ผต2251': 'ต้องตรวจสอบ',
        '70-1541': 'ต้องตรวจสอบ',
        'บธ4': 'ต้องตรวจสอบ',
        '70-2082': 'ต้องตรวจสอบ',
    };

    // 1. Fix transactions where license plate = owner name (like อ.อารยะวงศ์)
    console.log('1. แก้รายการที่ทะเบียน = ชื่อเจ้าของ\n');

    const specialPlates = ['อ.อารยะวงศ์', 'ท่าทรายถาวร', 'สต๊อก'];

    for (const plateName of specialPlates) {
        // Find or create owner
        let owner = await prisma.owner.findFirst({
            where: { name: { contains: plateName } }
        });

        if (!owner) {
            owner = await prisma.owner.create({
                data: {
                    name: plateName,
                    groupType: 'GENERAL_CREDIT',
                }
            });
            console.log(`✅ Created owner: ${plateName}`);
        }

        // Update transactions
        const updated = await prisma.transaction.updateMany({
            where: {
                licensePlate: plateName,
                paymentType: 'CREDIT',
                OR: [{ ownerName: null }, { ownerName: '' }],
                deletedAt: null,
            },
            data: {
                ownerName: owner.name,
                ownerId: owner.id,
            }
        });

        if (updated.count > 0) {
            console.log(`✅ ${plateName}: ${updated.count} รายการ`);
        }
    }

    // 2. 82-0735 → ท่าทรายถาวร
    console.log('\n2. แก้ 82-0735 → ท่าทรายถาวร\n');

    const thasai = await prisma.owner.findFirst({
        where: { name: { contains: 'ท่าทราย' } }
    });

    if (thasai) {
        const updated = await prisma.transaction.updateMany({
            where: {
                licensePlate: '82-0735',
                paymentType: 'CREDIT',
                OR: [{ ownerName: null }, { ownerName: '' }],
                deletedAt: null,
            },
            data: { ownerName: thasai.name, ownerId: thasai.id }
        });
        console.log(`✅ 82-0735: ${updated.count} รายการ`);
    }

    // 3. Check remaining
    console.log('\n3. รายการที่ยังเหลือ (ต้องตรวจสอบ manual)\n');

    const remaining = await prisma.transaction.findMany({
        where: {
            paymentType: 'CREDIT',
            OR: [{ ownerName: null }, { ownerName: '' }],
            deletedAt: null,
        },
        select: { licensePlate: true, amount: true, date: true },
        orderBy: { date: 'desc' }
    });

    if (remaining.length === 0) {
        console.log('✅ ไม่มีรายการเหลือแล้ว!');
    } else {
        console.log(`⚠️ ยังเหลือ ${remaining.length} รายการ:`);
        remaining.forEach((t: any) => {
            console.log(`- ${t.licensePlate || 'NO_PLATE'} | ฿${t.amount} | ${t.date.toISOString().split('T')[0]}`);
        });

        console.log('\n⚠️ รายการเหล่านี้ต้องตรวจสอบว่าเป็นของใคร');
    }

    await prisma.$disconnect();
}

fixAllMissingOwners();
