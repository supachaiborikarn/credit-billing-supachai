import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeBoxTruckTransactions() {
    console.log('=== วิเคราะห์รายการ BOX_TRUCK ที่ไม่มี Invoice ===\n');

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    // Get all BOX_TRUCK transactions without invoice in this period
    const boxTruckTransactions = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            invoiceId: null,
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
        include: {
            owner: { select: { id: true, name: true, code: true } },
            station: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
    });

    console.log(`พบ ${boxTruckTransactions.length} รายการ BOX_TRUCK ที่ยังไม่มี invoice\n`);

    // Analyze owner status
    const withOwner = boxTruckTransactions.filter(t => t.ownerId !== null);
    const withoutOwner = boxTruckTransactions.filter(t => t.ownerId === null);

    console.log(`📊 สถานะ ownerId:`);
    console.log(`   - มีเจ้าของ (ownerId): ${withOwner.length} รายการ`);
    console.log(`   - ไม่มีเจ้าของ (ownerId = null): ${withoutOwner.length} รายการ\n`);

    // Check if they have ownerName instead
    const withOwnerName = withoutOwner.filter(t => t.ownerName && t.ownerName.trim() !== '');
    console.log(`   - มี ownerName แทน: ${withOwnerName.length} รายการ`);

    // List unique owner names for transactions without ownerId
    if (withOwnerName.length > 0) {
        const ownerNames = [...new Set(withOwnerName.map(t => t.ownerName))];
        console.log(`\n👤 รายชื่อ ownerName ที่พบ (ไม่มี ownerId):`);
        ownerNames.slice(0, 30).forEach(name => {
            const count = withOwnerName.filter(t => t.ownerName === name).length;
            const total = withOwnerName.filter(t => t.ownerName === name).reduce((sum, t) => sum + Number(t.amount), 0);
            console.log(`   ${name}: ${count} รายการ, ${total.toFixed(2)} บาท`);
        });
        if (ownerNames.length > 30) {
            console.log(`   ... และอีก ${ownerNames.length - 30} ราย`);
        }
    }

    // Sample transactions
    console.log('\n📋 ตัวอย่างรายการ:');
    withoutOwner.slice(0, 10).forEach(t => {
        const dateStr = t.date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
        console.log(`   ${dateStr} | ${t.licensePlate || '-'} | ${t.ownerName || '-'} | ${t.station?.name || '-'} | ${Number(t.amount).toFixed(2)} บาท`);
    });

    // Check if there are matching owners in the database
    if (withOwnerName.length > 0) {
        const ownerNames = [...new Set(withOwnerName.map(t => t.ownerName).filter(Boolean))];

        console.log('\n🔍 ตรวจสอบ Owner ที่ตรงกันในฐานข้อมูล:');

        for (const name of ownerNames.slice(0, 20)) {
            const existingOwner = await prisma.owner.findFirst({
                where: {
                    OR: [
                        { name: { contains: name as string, mode: 'insensitive' } },
                        { name: name as string },
                    ]
                },
                select: { id: true, name: true, code: true }
            });

            if (existingOwner) {
                console.log(`   ✅ "${name}" -> พบ: ${existingOwner.name} (${existingOwner.id})`);
            } else {
                console.log(`   ❌ "${name}" -> ไม่พบในฐานข้อมูล`);
            }
        }
    }

    await prisma.$disconnect();
}

analyzeBoxTruckTransactions().catch(console.error);
