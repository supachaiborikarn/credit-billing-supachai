/**
 * Merge Duplicate Owners Script
 * 
 * รวมชื่อซ้ำตามที่ user ชี้แจง
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ชื่อที่ต้อง merge: [ชื่อเก่า, ชื่อเก่า2, ...] → ชื่อหลัก
const MERGE_MAP: Record<string, string[]> = {
    // TKC
    'บจก.ทีเคซีมอเตอร์ไบค์': ['ทีเคซีมอเตอร์ไบค์', 'tkc มอเตอร์ไบค์'],
    'ทีเคซีรถเก่า': ['ทีเคซี', 'tkc รถเก่า'],

    // ฮอนด้า
    'บ.ฮอนด้ากำแพงเพชร (ลูกค้า)': ['ฮอนด้า'],

    // มัชฌิมา
    'บจก. มัชฌิมา ดิสทริบิวเตอร์': ['มัชฌิมาดิสทริบิวเตอร์'],

    // สุธรรม
    'สุธรรม อิ่มสุนทรรักษา': ['สุธรรม'],

    // กำแพงเพชรวีระวณิชย์
    'บจก.กำแพงเพชรวีระวณิชย์': ['กำแพงเพชรวีระวณิชย์'],

    // เคพีออกซิเจน
    'บจก. เค พี ออกซิเจนกรุ๊ป': ['เคพีออกซิเจน', 'บริษัทเคพีออกซิเจน'],

    // ที่ทำการปกครอง
    'ที่ทำการปกครอง (บ/ช)': ['ที่ทำการปกครองจังหวัดกำแพงเพชร', 'ปกครองจังหวัดกำแพง'],

    // ทองศุภกิจ = ศุภกิจ
    'ทองศุภกิจ': ['ศุภกิจ'],

    // ดุษฎีบัณฑ์
    'บจก.ดุษฎีบัณฑ์': ['ดูษฎีบัณณ์'],

    // วรวัฒน์
    'วรวัฒน์ขนส่ง': ['บริษัทวรวัฒน์ขนส่งจำกัด'],

    // เฉลิมพระเกียรติ
    'โรงเรียนเฉลิมพระเกียรติ': ['รร.เฉลิมพระเกียรติ'],

    // ศรีเจริญ
    'กำแพงเพชรศรีเจริญ': ['ศรีเจริญ'],

    // อีซูซุเสียงไพศาล
    'บจก.อีซูซุเสียงไพศาล กำแพงเพชร': ['บริษัท อีซูซุเสียงไพศาล', 'บริษัท อีซูซุ เสียงไพศาลกำแพงเพชรจำกัด'],

    // ฮั่นพงษ์กี่
    'หจก.ฮั่นพงษ์กี่ (PEPSI)': ['ฮั่นพงษ์กี่'],

    // นิสสัน
    'สยามนิสสัน กำแพงเพชร': ['nissan', 'นิสสัน'],

    // อีซูซุเสนียนต์
    'บจก.อีซูซุเสนียนต์นครสวรรค์': ['อีซูซุเสนีย์ยนต์นครสวรรค์'],

    // แม็กกู๊ดคาร์
    'บจก.แม็กกู๊ดคาร์': ['บริษัทแม็ก กู๊ด คาร์จำกัด', 'บ. แม็กกู๊ดคาร์'],

    // จรูญพานิช
    'ห้างจรูญพานิช': ['จรูญพาณิชย์'],

    // โรงพยาบาลเอกชน
    'รพ.เอกชนเมืองกำแพง': ['รพ.เอกชน', 'โรงพยาบาลเอกชน'],

    // ณัฐพลการโยธา
    'ณัฐพลการโยธา': ['ณัฐพล การโยธา'],

    // ศูนย์การศึกษาพิเศษ
    'ศูนย์การศึกษาพิเศษ': ['ศูนย์การศึกษาพิเศษประจำจังหวัดกำแพงเพชร'],

    // เพชรคอนสตรัคชั่น
    'บจก.เพชร คอนสตรัคชั่น': ['เพชรคอนสตรัคชั่น'],

    // จรูญการยาง
    'หจก.จรูญการยาง': ['จรูญการยาง'],

    // พงษ์ผกา - keep all variants as one
    'หจก.พงษ์ผกาขนส่ง': ['หจก.พงผกาขนส่ง', 'พงษ์ผกาขนส่ง'],
};

// ชื่อที่เก็บแยก (ไม่ merge):
// - สมาน, แสบ, แถม, ตึ๋ง, ไผ่, โจ, เอ็ม (รถตู้ทึบ)
// - พี่อ้อย (เงินเชื่อทั่วไป)
// - พี่หมู (รถน้ำมันเราเอง)
// - ศุภกิจเจริญ (แยกจากทองศุภกิจ)
// - หจก.ฉั่วการช่าง vs ฉ การช่าง (2 เจ้าแยกกัน)
// - ชลประทาน, กำแพงเพชรแก๊ส (ลูกค้าใหม่)

async function mergeOwners() {
    console.log('=== MERGE DUPLICATE OWNERS ===\n');

    let totalMerged = 0;
    let totalDeleted = 0;

    for (const [mainName, duplicateNames] of Object.entries(MERGE_MAP)) {
        // Find main owner
        const mainOwner = await prisma.owner.findFirst({
            where: { name: { equals: mainName, mode: 'insensitive' } }
        });

        if (!mainOwner) {
            console.log(`⚠️ ไม่พบ: ${mainName}`);
            continue;
        }

        for (const dupName of duplicateNames) {
            // Find duplicate owner
            const dupOwner = await prisma.owner.findFirst({
                where: { name: { equals: dupName, mode: 'insensitive' } }
            });

            if (!dupOwner || dupOwner.id === mainOwner.id) continue;

            // Move trucks to main owner
            const trucksUpdated = await prisma.truck.updateMany({
                where: { ownerId: dupOwner.id },
                data: { ownerId: mainOwner.id }
            });

            // Move transactions to main owner
            const txUpdated = await prisma.transaction.updateMany({
                where: { ownerId: dupOwner.id },
                data: { ownerId: mainOwner.id }
            });

            // Delete duplicate owner
            await prisma.owner.delete({ where: { id: dupOwner.id } });

            console.log(`✓ "${dupName}" → "${mainName}" (${trucksUpdated.count} trucks, ${txUpdated.count} tx)`);
            totalMerged++;
            totalDeleted++;
        }
    }

    console.log(`\n=== สรุป ===`);
    console.log(`Merged: ${totalMerged} ชื่อ`);
    console.log(`Deleted: ${totalDeleted} owners`);

    // Final counts
    const counts = await Promise.all([
        prisma.owner.count(),
        prisma.truck.count(),
        prisma.transaction.count({ where: { ownerId: { not: null } } })
    ]);

    console.log(`\nOwners คงเหลือ: ${counts[0]}`);
    console.log(`Trucks: ${counts[1]}`);
    console.log(`Transactions linked: ${counts[2]}`);

    console.log('\n✅ เสร็จ!');
    await prisma.$disconnect();
}

mergeOwners().catch(e => {
    console.error('Error:', e);
    prisma.$disconnect();
});
