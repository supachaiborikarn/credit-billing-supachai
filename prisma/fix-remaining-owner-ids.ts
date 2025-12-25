const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Manual mapping for known mismatches and common variations
const OWNER_MAPPINGS: Record<string, string> = {
    'tkc มอเตอร์ไบค์': 'บจก.ทีเคซีมอเตอร์ไบค์',
    'จรูญพาณิชย์': 'ห้างจรูญพานิช',
    'บริษัทเคพีออกซิเจน': 'บ.เคพี ออกซิเจน',
    'บริษัทแม็กกู๊ดคาร์จำกัด': 'บจก.แม็กกู๊ดคาร์',
    'ป สยามขนส่ง': 'ป.สยามขนส่ง',
    'ร.พ เอกชนกำแพงเพชร': 'โรงพยาบาลเอกชนเมืองกำแพงเพชร',
    'โรงพยาบาลเอกชนเมืองกำแพงเพชร': 'โรงพยาบาลเอกชนเมืองกำแพงเพชร',
    'รร.เฉลิมพระเกียรติ': 'โรงเรียนเฉลิมพระเกียรติ',
    'เคพี ออกซิเจน': 'บ.เคพี ออกซิเจน',
    'เคพีออกซิเจน': 'บ.เคพี ออกซิเจน',
    'เพชรคอนสตรัคชั่น': 'พร้อมเพชร คอนสตรัคชั่น',
    'พี่ออ้ย': 'ออ้ย',
    'น้ำตาลนครเพชร': 'น้ำตาลนครเพชร',
    'เจ้เงาะ': 'เงาะ',
};

async function fixRemainingOwnerIds() {
    console.log('=== แก้ไข transactions ที่ยังขาด ownerId ===\n');

    // 1. หา transactions ที่ยังขาด ownerId
    const transactionsWithoutOwnerId = await prisma.transaction.findMany({
        where: {
            ownerName: { not: null },
            ownerId: null,
            deletedAt: null,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK'] }
        },
        orderBy: { date: 'desc' },
        select: {
            id: true,
            date: true,
            ownerName: true,
            paymentType: true,
            amount: true
        }
    });

    console.log(`🔍 พบ ${transactionsWithoutOwnerId.length} transactions ที่ขาด ownerId\n`);

    if (transactionsWithoutOwnerId.length === 0) {
        console.log('✅ ไม่มี transactions ที่ต้องแก้ไข');
        await prisma.$disconnect();
        return;
    }

    // Show all owners in system that might match
    const allOwners = await prisma.owner.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true }
    });

    // 2. Group by ownerName
    const groupedByOwner: Record<string, any[]> = {};
    transactionsWithoutOwnerId.forEach((t: any) => {
        const name = t.ownerName || 'Unknown';
        if (!groupedByOwner[name]) {
            groupedByOwner[name] = [];
        }
        groupedByOwner[name].push(t);
    });

    console.log('📊 รายการที่ต้องแก้ไข:');
    console.log('─'.repeat(80));

    const ownerNames = Object.keys(groupedByOwner).sort();
    let fixedCount = 0;
    let notFoundCount = 0;

    for (const ownerName of ownerNames) {
        // Skip Unknown
        if (ownerName === 'Unknown') {
            console.log(`⏭️  Unknown: ข้าม (${groupedByOwner[ownerName].length} รายการ)`);
            notFoundCount += groupedByOwner[ownerName].length;
            continue;
        }

        // Try manual mapping first
        const mappedName = OWNER_MAPPINGS[ownerName];
        let matchedOwner = null;

        if (mappedName) {
            matchedOwner = allOwners.find((o: any) => o.name === mappedName);
            if (!matchedOwner) {
                // Try contains search with mapped name
                matchedOwner = allOwners.find((o: any) =>
                    o.name.includes(mappedName) || mappedName.includes(o.name)
                );
            }
        }

        // If no mapping, try exact match
        if (!matchedOwner) {
            matchedOwner = allOwners.find((o: any) => o.name === ownerName);
        }

        // If still no match, try flexible search
        if (!matchedOwner) {
            // Remove common prefixes/suffixes for matching
            const cleanName = ownerName
                .replace(/^(บจก\.|บริษัท|นาย|นาง|นางสาว|ห้าง|ร\.พ\s|รร\.)/, '')
                .trim();

            matchedOwner = allOwners.find((o: any) => {
                const cleanOwnerName = o.name
                    .replace(/^(บจก\.|บริษัท|นาย|นาง|นางสาว|ห้าง|ร\.พ\s|รร\.)/, '')
                    .trim();
                return cleanOwnerName === cleanName ||
                    cleanOwnerName.includes(cleanName) ||
                    cleanName.includes(cleanOwnerName);
            });
        }

        if (matchedOwner) {
            const result = await prisma.transaction.updateMany({
                where: {
                    ownerName: ownerName,
                    ownerId: null,
                    deletedAt: null
                },
                data: {
                    ownerId: matchedOwner.id
                }
            });

            console.log(`✅ "${ownerName}" -> "${matchedOwner.name}" : ${result.count} รายการ`);
            fixedCount += result.count;
        } else {
            const txns = groupedByOwner[ownerName];
            const total = txns.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
            console.log(`❌ "${ownerName}" : ${txns.length} รายการ (${total.toLocaleString()} บาท)`);

            // Show possible matches
            const possibleMatches = allOwners.filter((o: any) =>
                o.name.toLowerCase().includes(ownerName.toLowerCase().substring(0, 3)) ||
                ownerName.toLowerCase().includes(o.name.toLowerCase().substring(0, 3))
            ).slice(0, 3);

            if (possibleMatches.length > 0) {
                console.log(`   🔎 อาจตรงกับ: ${possibleMatches.map((o: any) => o.name).join(', ')}`);
            }

            notFoundCount += txns.length;
        }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`📊 สรุปผล: ✅ แก้ไขสำเร็จ ${fixedCount} รายการ | ❌ ไม่พบ ${notFoundCount} รายการ`);

    await prisma.$disconnect();
}

fixRemainingOwnerIds().catch(console.error);
