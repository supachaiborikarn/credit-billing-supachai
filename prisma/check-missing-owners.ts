const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMissingOwners() {
    console.log('=== ตรวจสอบรายการ CREDIT ที่ไม่มีชื่อเจ้าของ ===\n');

    // Find all CREDIT transactions without owner name
    const noOwner = await prisma.transaction.findMany({
        where: {
            paymentType: 'CREDIT',
            OR: [
                { ownerName: null },
                { ownerName: '' },
            ],
            deletedAt: null,
        },
        select: {
            id: true,
            licensePlate: true,
            ownerName: true,
            amount: true,
            date: true,
            station: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        take: 50
    });

    console.log(`Found ${noOwner.length} CREDIT transactions without owner name:\n`);

    // Group by license plate
    const byPlate: Record<string, any[]> = {};
    noOwner.forEach((t: any) => {
        const plate = t.licensePlate || 'NO_PLATE';
        if (!byPlate[plate]) byPlate[plate] = [];
        byPlate[plate].push(t);
    });

    for (const [plate, txns] of Object.entries(byPlate)) {
        console.log(`\n📌 ${plate} (${txns.length} รายการ)`);
        txns.forEach((t: any) => {
            const date = t.date.toISOString().split('T')[0];
            console.log(`   - ${date} | ฿${t.amount} | ${t.station?.name}`);
        });
    }

    // Also check for plates with weird data (C-codes mixed in)
    console.log('\n\n=== ตรวจสอบทะเบียนที่มีรูปแบบผิดปกติ ===\n');

    const weirdPlates = await prisma.transaction.findMany({
        where: {
            OR: [
                { licensePlate: { contains: ' C' } },
                { licensePlate: { startsWith: 'C' } },
            ],
            deletedAt: null,
        },
        select: { licensePlate: true, ownerName: true },
        distinct: ['licensePlate']
    });

    if (weirdPlates.length > 0) {
        console.log('Plates with C-Code pattern:');
        weirdPlates.forEach((t: any) => {
            console.log(`- ${t.licensePlate} → ${t.ownerName || 'NO OWNER'}`);
        });
    } else {
        console.log('✅ No plates with C-Code mixed in');
    }

    await prisma.$disconnect();
}

checkMissingOwners();
