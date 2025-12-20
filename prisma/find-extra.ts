import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function findExtra() {
    console.log('=== หารายการที่อยู่ในระบบแต่ไม่มีในใบบันทึก ===\n');

    const startOfDay = new Date('2025-12-19T00:00:00+07:00');
    startOfDay.setHours(startOfDay.getHours() - 7);

    const endOfDay = new Date('2025-12-19T23:59:59+07:00');
    endOfDay.setHours(endOfDay.getHours() - 7);

    const credit = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: startOfDay, lte: endOfDay },
            paymentType: 'CREDIT',
            deletedAt: null,
        },
        select: {
            licensePlate: true,
            ownerName: true,
            liters: true,
            amount: true,
            billBookNo: true,
            billNo: true,
        },
        orderBy: { amount: 'desc' }
    });

    // ทะเบียนที่ปรากฏในใบบันทึกหน้า 2+3 (จากรูป)
    const paperPlates = [
        '80-0900', '81-0728', '81-4165', 'บพ-2624', '82-1954', '83-7657', '83-3666',
        '80-0901', '83-5272', '83-5435', '82-9148', '82-5953', '80-3362', '83-7575',
        '83-3481', '80-1792', '80-1902', 'แทรคเตอร์', '83-3945', '83-5757', '80-6592',
        'ตง-4941', '83-1489', 'กข-140', '83-5345', 'กข-195', '83-6969', '83-8624',
        '83-1434', '82-0132', '82-6000', '80-1278', 'รล-8555', '70-2177', '80-7466',
        '81-4397', '80-9992', '83-0450'
    ];

    console.log('รายการในระบบที่อาจไม่มีในใบบันทึก:');
    let extraTotal = 0;

    for (const t of credit) {
        const sysPlate = (t.licensePlate || '').replace(/กพ/g, '').replace(/-/g, '').trim();
        let found = false;

        for (const pp of paperPlates) {
            const paperClean = pp.replace(/-/g, '').replace(/กพ/g, '').trim();
            if (sysPlate.includes(paperClean) || paperClean.includes(sysPlate)) {
                found = true;
                break;
            }
        }

        if (!found) {
            const amt = Number(t.amount);
            extraTotal += amt;
            console.log(`  ${t.licensePlate?.padEnd(20)} | ${Number(t.liters).toFixed(2).padStart(8)} L | ${amt.toFixed(2).padStart(10)} บาท | ${t.ownerName?.substring(0, 15)} | bill ${t.billNo}`);
        }
    }

    console.log('\nรวมรายการพิเศษ:', extraTotal.toFixed(2), 'บาท');

    await prisma.$disconnect();
}

findExtra();
