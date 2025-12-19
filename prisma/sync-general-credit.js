const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// รายชื่อลูกค้า GENERAL_CREDIT ที่ถูกต้อง (41 ราย)
const validCustomers = [
    'ธนาคารอาคารสงเคราะห์ กำแพงเพชร',
    'วรวัฒน์ขนส่ง',
    'สมาคมชาวไร่อ้อย',
    'มิตรดีเซลออโต้เซอร์วิส',
    'ณัฐพลการโยธา',
    'หจก.กำแพงเพชรง่วนยงหลี',
    'วิทยาลัยเกษตรและเทคโนโลยี กำแพงเพชร',
    'ภูวิเศษออยส์',
    'ห้างรุ่งเพชรพาณิช',
    'บจก.เพชร คอนสตรัคชั่น',
    'โรงเรียนเฉลิมพระเกียรติ',
    'ที่ทำการปกครอง',
    'พีเอสเซฟไดร์ฟ',
    'ทีเคซีรถเก่า',
    'บจก.ทีเคชีมอเตอร์ไบค์',
    'ศูนย์การศึกษาพิเศษ',
    'ร้าน 180 อลูมิเนียม',
    'หจก.จรูญการยาง',
    'บจก.ดุษฎีบัณฑ์',
    'บ.น้ำตาลนครเพชร',
    'กำแพงเพชรศรีเจริญ',
    'บจก.กำแพงเพชรวีระวณิชย์',
    'ทองศุภกิจ',
    'บ.ฮอนด้ากำแพงเพชร',
    'ฉ่ำการช่าง',
    'สุธรรม อิ่มสุนทรรักษา',
    'บจก.แม็กกู๊ดคาร์',
    'สยามนิสสัน กำแพงเพชร',
    'บจก. มัชฒิมา ดิสทริบิวเตอร์',
    'รพ.เอกชนเมืองกำแพง',
    'หจก.อันพงษ์กี้ (PEPSI)',
    'เอ็มเคทีคอนสตรัคชั่น',
    'บจก. เค พี ออกซิเจนกรุป',
    'บจก.อีซูซุพิจิตร (1999)',
    'บจก.อีซูซุสินต์นครสวรรค์',
    'ท่าทรายถาวร',
    'ทรายทองอ๊อกซิเจน',
    'บจก.อ.อารยะวงศ์',
    'บจก.อีซูเสียงไพศาล กำแพงเพชร',
    'การไฟฟ้ากำแพงเพชร',
    'อินทรา',
];

async function syncGeneralCredit() {
    console.log('===== SYNC GENERAL_CREDIT CUSTOMERS =====\n');
    console.log('Valid customers from list:', validCustomers.length);

    // 1. Get current GENERAL_CREDIT owners
    const current = await prisma.owner.findMany({
        where: { groupType: 'GENERAL_CREDIT', deletedAt: null }
    });
    console.log('Current active GENERAL_CREDIT:', current.length);

    // 2. Soft delete owners NOT in the valid list
    let deletedCount = 0;
    for (const owner of current) {
        const isValid = validCustomers.some(name =>
            owner.name.includes(name) || name.includes(owner.name)
        );

        if (!isValid) {
            await prisma.owner.update({
                where: { id: owner.id },
                data: { deletedAt: new Date() }
            });
            console.log('Deleted:', owner.name);
            deletedCount++;
        }
    }

    // 3. Restore/Create valid owners
    let restoredCount = 0;
    let createdCount = 0;

    for (const name of validCustomers) {
        // Try to find existing (including deleted)
        const existing = await prisma.owner.findFirst({
            where: {
                OR: [
                    { name: { contains: name } },
                    { name: name }
                ]
            }
        });

        if (existing) {
            if (existing.deletedAt) {
                await prisma.owner.update({
                    where: { id: existing.id },
                    data: { deletedAt: null, groupType: 'GENERAL_CREDIT' }
                });
                console.log('Restored:', name);
                restoredCount++;
            }
        } else {
            await prisma.owner.create({
                data: { name, groupType: 'GENERAL_CREDIT' }
            });
            console.log('Created:', name);
            createdCount++;
        }
    }

    // Final count
    const finalCount = await prisma.owner.count({
        where: { groupType: 'GENERAL_CREDIT', deletedAt: null }
    });

    console.log('\n===== SUMMARY =====');
    console.log('Deleted:', deletedCount);
    console.log('Restored:', restoredCount);
    console.log('Created:', createdCount);
    console.log('Final GENERAL_CREDIT count:', finalCount);

    await prisma.$disconnect();
}

syncGeneralCredit();
