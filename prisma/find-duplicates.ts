const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// รายชื่อลูกค้าหลัก 41 ราย จาก user
const MAIN_CUSTOMERS = [
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

async function findDuplicates() {
    console.log('=== ตรวจสอบชื่อลูกค้าซ้ำ/คล้าย ===\n');

    // Get all owners from database
    const allOwners = await prisma.owner.findMany({
        where: { groupType: 'GENERAL_CREDIT' },
        include: {
            _count: { select: { trucks: true, transactions: true } }
        },
        orderBy: { name: 'asc' }
    });

    console.log('GENERAL_CREDIT owners ทั้งหมด:', allOwners.length);
    console.log('รายชื่อหลัก:', MAIN_CUSTOMERS.length, '\n');

    // Find owners that might be duplicates or similar to main customers
    const potentialDuplicates = [];
    const unmatched = [];

    for (const owner of allOwners) {
        const ownerNameLower = owner.name.toLowerCase().trim();

        // Check if exact match with any main customer
        const exactMatch = MAIN_CUSTOMERS.find(main =>
            main.toLowerCase().trim() === ownerNameLower
        );

        if (exactMatch) {
            continue; // Skip exact matches
        }

        // Check for partial/similar matches
        let bestMatch = null;
        let bestScore = 0;

        for (const main of MAIN_CUSTOMERS) {
            const mainLower = main.toLowerCase().trim();

            // Simple similarity check - contains key words
            const mainWords = mainLower.split(/[\s\-\.]+/).filter(w => w.length > 2);
            const ownerWords = ownerNameLower.split(/[\s\-\.]+/).filter(w => w.length > 2);

            // Count matching words
            const matchingWords = mainWords.filter(w =>
                ownerWords.some(ow => ow.includes(w) || w.includes(ow))
            ).length;

            if (matchingWords > 0) {
                const score = matchingWords / Math.max(mainWords.length, 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = main;
                }
            }
        }

        if (bestMatch && bestScore >= 0.3) {
            potentialDuplicates.push({
                owner: owner.name,
                ownerId: owner.id,
                trucks: owner._count.trucks,
                transactions: owner._count.transactions,
                matchWith: bestMatch,
                score: bestScore
            });
        } else {
            unmatched.push({
                owner: owner.name,
                ownerId: owner.id,
                trucks: owner._count.trucks,
                transactions: owner._count.transactions
            });
        }
    }

    console.log('=== อาจเป็นชื่อซ้ำ (ควร merge) ===');
    console.log('พบ:', potentialDuplicates.length, 'รายการ\n');

    potentialDuplicates.sort((a, b) => b.score - a.score);
    potentialDuplicates.forEach(d => {
        console.log(`"${d.owner}" → "${d.matchWith}"`);
        console.log(`   รถ: ${d.trucks}, ธุรกรรม: ${d.transactions}`);
    });

    console.log('\n=== ชื่อที่ไม่ตรงกับรายชื่อหลัก ===');
    console.log('พบ:', unmatched.length, 'รายการ\n');

    unmatched.slice(0, 30).forEach(u => {
        console.log(`- ${u.owner} (รถ: ${u.trucks}, tx: ${u.transactions})`);
    });

    if (unmatched.length > 30) {
        console.log(`... และอีก ${unmatched.length - 30} รายการ`);
    }

    await prisma.$disconnect();
}

findDuplicates().catch(console.error);
