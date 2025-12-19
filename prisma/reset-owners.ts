/**
 * Reset Owners Script v2 - Optimized with batch operations
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Master List ลูกค้าหลัก 41 ราย
const GENERAL_CREDIT_CUSTOMERS = [
    'ธนาคารอาคารสงเคราะห์ กำแพงเพชร',
    'วรวัฒน์ขนส่ง',
    'สมาคมชาวไร่อ้อย',
    'มิตรดีเซลออโต้เซอร์วิส',
    'ณัฐพลการโยธา',
    'หจก.กำแพงเพชรง่วนฮงหลี',
    'วิทยาลัยเกษตรและเทคโนโลยี กำแพงเพชร',
    'ภูวิเศษออยล์',
    'ห้างจรูญพานิช',
    'บจก.เพชร คอนสตรัคชั่น',
    'โรงเรียนเฉลิมพระเกียรติ',
    'ที่ทำการปกครอง (บ/ช)',
    'พีเอสเชฟไดร์ฟ',
    'ทีเคซีรถเก่า',
    'บจก.ทีเคซีมอเตอร์ไบค์',
    'ศูนย์การศึกษาพิเศษ',
    'ร้าน 180 อลูมิเนียม',
    'หจก.จรูญการยาง',
    'บจก.ดุษฎีบัณฑ์',
    'บ.น้ำตาลนครเพรช',
    'กำแพงเพชรศรีเจริญ',
    'บจก.กำแพงเพชรวีระวณิชย์',
    'ทองศุภกิจ',
    'บ.ฮอนด้ากำแพงเพชร (ลูกค้า)',
    'ฉั่วการช่าง',
    'สุธรรม อิ่มสุนทรรักษา',
    'บจก.แม็กกู๊ดคาร์',
    'สยามนิสสัน กำแพงเพชร',
    'บจก. มัชฌิมา ดิสทริบิวเตอร์',
    'รพ.เอกชนเมืองกำแพง',
    'หจก.ฮั่นพงษ์กี่ (PEPSI)',
    'เอ็มเคทีคอนสตรัคชั่น',
    'บจก. เค พี ออกซิเจนกรุ๊ป',
    'บจก.อีซูซุพิจิตร (1999)',
    'บจก.อีซูซุเสนียนต์นครสวรรค์',
    'ท่าทรายถาวร',
    'ทรายทองอ๊อกซิเจน',
    'บจก.อ.อารยะวงศ์',
    'บจก.อีซูซุเสียงไพศาล กำแพงเพชร',
    'การไฟฟ้ากำแพงเพชร',
    'อินทรา',
];

async function resetOwners() {
    console.log('=== RESET OWNERS v2 (Optimized) ===\n');

    // Step 1: Get unique ownerNames from transactions
    console.log('STEP 1: หา ownerNames จาก transactions...');
    const transactions = await prisma.transaction.findMany({
        where: {
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
            ownerName: { not: null }
        },
        select: { id: true, ownerName: true }
    });

    const uniqueNames = new Map<string, string>();
    transactions.forEach(t => {
        if (t.ownerName) {
            const key = t.ownerName.trim().toLowerCase();
            if (!uniqueNames.has(key)) {
                uniqueNames.set(key, t.ownerName.trim());
            }
        }
    });
    console.log(`พบ ${uniqueNames.size} ชื่อ unique จาก ${transactions.length} tx\n`);

    // Step 2: Read SUGAR_FACTORY from CSV
    console.log('STEP 2: อ่าน CSV...');
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const sugarFactoryData: { name: string; code: string; plate: string }[] = [];
    const sugarFactoryNames = new Set<string>();

    if (fs.existsSync(csvPath)) {
        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1);
        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = line.split(',');
            const name = parts[2]?.trim();
            const code = parts[4]?.trim();
            const plate = parts[5]?.trim();
            if (name && code?.startsWith('C') && plate) {
                sugarFactoryNames.add(name);
                sugarFactoryData.push({ name, code, plate });
            }
        });
        console.log(`CSV: ${sugarFactoryNames.size} owners, ${sugarFactoryData.length} trucks\n`);
    }

    // Step 3: Find extra names from transactions
    const masterNamesLower = new Set([
        ...GENERAL_CREDIT_CUSTOMERS.map(n => n.toLowerCase()),
        ...Array.from(sugarFactoryNames).map(n => n.toLowerCase())
    ]);

    const extraNames: string[] = [];
    uniqueNames.forEach((originalName, lowerName) => {
        if (!masterNamesLower.has(lowerName)) {
            extraNames.push(originalName);
        }
    });
    console.log(`STEP 3: พบ ${extraNames.length} ชื่อไม่อยู​่ใน list\n`);

    // Step 4: Delete old data
    console.log('STEP 4: ลบข้อมูลเก่า...');
    await prisma.transaction.updateMany({ data: { ownerId: null, truckId: null } });
    console.log('  - Unlinked transactions');
    await prisma.truck.deleteMany({});
    console.log('  - Deleted trucks');
    await prisma.payment.deleteMany({});
    await prisma.invoice.deleteMany({});
    console.log('  - Deleted invoices');
    await prisma.owner.deleteMany({});
    console.log('  - Deleted owners\n');

    // Step 5: Create all owners in batch
    console.log('STEP 5: สร้าง Owners (batch)...');

    // GENERAL_CREDIT
    await prisma.owner.createMany({
        data: GENERAL_CREDIT_CUSTOMERS.map(name => ({
            name,
            groupType: 'GENERAL_CREDIT'
        })),
        skipDuplicates: true
    });
    console.log(`  - GENERAL_CREDIT: ${GENERAL_CREDIT_CUSTOMERS.length}`);

    // SUGAR_FACTORY
    const sfOwnerData = Array.from(sugarFactoryNames).map(name => ({
        name,
        groupType: 'SUGAR_FACTORY'
    }));
    await prisma.owner.createMany({ data: sfOwnerData, skipDuplicates: true });
    console.log(`  - SUGAR_FACTORY: ${sfOwnerData.length}`);

    // Extra from transactions
    if (extraNames.length > 0) {
        await prisma.owner.createMany({
            data: extraNames.map(name => ({
                name,
                groupType: 'GENERAL_CREDIT'
            })),
            skipDuplicates: true
        });
    }
    console.log(`  - จาก transactions: ${extraNames.length}\n`);

    // Step 6: Create trucks for SUGAR_FACTORY
    console.log('STEP 6: สร้าง Trucks...');
    const allOwners = await prisma.owner.findMany({ select: { id: true, name: true } });
    const ownerMap = new Map(allOwners.map(o => [o.name.toLowerCase(), o.id]));

    const trucksToCreate: { licensePlate: string; code: string; ownerId: string }[] = [];
    const seenPlates = new Set<string>();

    sugarFactoryData.forEach(({ name, code, plate }) => {
        const ownerId = ownerMap.get(name.toLowerCase());
        if (ownerId && !seenPlates.has(plate)) {
            trucksToCreate.push({ licensePlate: plate, code, ownerId });
            seenPlates.add(plate);
        }
    });

    if (trucksToCreate.length > 0) {
        await prisma.truck.createMany({ data: trucksToCreate, skipDuplicates: true });
    }
    console.log(`  - สร้าง ${trucksToCreate.length} trucks\n`);

    // Step 7: Re-link transactions
    console.log('STEP 7: Link transactions...');
    let linked = 0;

    // Batch update by owner name
    for (const [lowerName, ownerId] of ownerMap) {
        const result = await prisma.transaction.updateMany({
            where: {
                ownerName: { contains: lowerName, mode: 'insensitive' },
                ownerId: null
            },
            data: { ownerId }
        });
        linked += result.count;
    }
    console.log(`  - Linked: ${linked} transactions\n`);

    // Final summary
    console.log('=== สรุป ===');
    const counts = await Promise.all([
        prisma.owner.count(),
        prisma.truck.count(),
        prisma.transaction.count({ where: { ownerId: { not: null } } }),
        prisma.transaction.count({ where: { ownerId: null, paymentType: { in: ['CREDIT', 'BOX_TRUCK'] } } })
    ]);

    console.log(`Owners: ${counts[0]}`);
    console.log(`Trucks: ${counts[1]}`);
    console.log(`Tx linked: ${counts[2]}`);
    console.log(`Tx not linked: ${counts[3]}`);

    if (extraNames.length > 0) {
        console.log('\n=== ลูกค้าที่ต้อง review ===');
        extraNames.forEach((n, i) => console.log(`${i + 1}. ${n}`));
    }

    console.log('\n✅ เสร็จ!');
    await prisma.$disconnect();
}

resetOwners().catch(e => {
    console.error('Error:', e);
    prisma.$disconnect();
});
