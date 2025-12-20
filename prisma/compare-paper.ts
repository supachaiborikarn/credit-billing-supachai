import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function compare() {
    console.log('=== เปรียบเทียบใบบันทึก vs ระบบ ===\n');

    // Get transactions for Dec 19
    const startOfDay = new Date('2025-12-19T00:00:00+07:00');
    startOfDay.setHours(startOfDay.getHours() - 7);

    const endOfDay = new Date('2025-12-19T23:59:59+07:00');
    endOfDay.setHours(endOfDay.getHours() - 7);

    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            date: { gte: startOfDay, lte: endOfDay },
            deletedAt: null,
        },
        select: {
            licensePlate: true,
            ownerName: true,
            liters: true,
            amount: true,
            paymentType: true,
            pricePerLiter: true,
        },
        orderBy: { date: 'asc' }
    });

    // รายการจากใบบันทึกหน้า 2 (เงินเชื่อ ราคา 31.34)
    const paper2 = [
        { plate: '80-0900', name: 'สมยศติ๊กโฑกศรีคณา', liters: 107.53, amount: 3370 },
        { plate: '81-0728', name: 'น.ส.มีริรัตน์ ศรีสะอาด', liters: 200, amount: 6268 },
        { plate: '81-4165', name: 'มณเสมีราชน์ ศรีสะอาด', liters: 200, amount: 6268 },
        { plate: 'บพ-2624', name: 'จัตรปู้ลิศิ (ชลประทาน)', liters: 400, amount: 12536 },
        { plate: '82-1954', name: 'จ่านาบทาร', liters: 134.97, amount: 4230 },
        { plate: '83-7657', name: 'อ.อารยะวงศ์', liters: 210.59, amount: 6600 },
        { plate: '83-3666', name: 'อุไรรัตน์ ปรีดาฤทธิ์', liters: 108.17, amount: 3390 },
        { plate: '80-0901', name: 'ท่าทรายถาวร', liters: 132, amount: 4137 },
        { plate: '83-5272', name: 'อ.อารยะวงศ์', liters: 191.77, amount: 6010 },
        { plate: '83-5435', name: 'อ.อารยะวงศ์', liters: 231.01, amount: 7240 },
        { plate: '82-9148', name: 'ท่าทรายถาวร', liters: 159.86, amount: 5010 },
        { plate: '82-5953', name: 'อ.อารยะวงศ์', liters: 292.60, amount: 9170 },
        { plate: '80-3362', name: 'สมรสุนมหศิ วัสแสงแก้ว', liters: 139.16, amount: 4360 },
        { plate: '83-7575', name: 'อ.อารยะวงศ์', liters: 164.96, amount: 5170 },
    ];

    // รายการจากใบบันทึกหน้า 3 (เงินเชื่อ ราคา 31.34)
    const paper3 = [
        { plate: '83-3481', name: 'นายสายรุ้ง สีแนม', liters: 245.69, amount: 7700 },
        { plate: '80-1792', name: 'ธัญญรัตน์ ถาวดี', liters: 143.59, amount: 4500 },
        { plate: '80-1902', name: 'นายสมคิด  ทรายจันทร์ล้าง', liters: 118.38, amount: 3710 },
        { plate: 'แทรคเตอร์', name: 'อ.อารยะวงศ์', liters: 300, amount: 9402 },
        { plate: '83-3945', name: 'อ.อารยะวงศ์', liters: 87, amount: 2727 },
        { plate: '83-5757', name: 'อ.อารยะวงศ์', liters: 137, amount: 4200 },
        { plate: '80-6592', name: 'อ.อารยะวงศ์', liters: 97.32, amount: 3050 },
        { plate: 'ตง-4941', name: 'อ.อารยะวงศ์', liters: 102.74, amount: 3220 },
        { plate: '83-1489', name: 'อ.อารยะวงศ์', liters: 98.71, amount: 3094 },
        { plate: 'กข-140', name: 'อ.อารยะวงศ์', liters: 97.84, amount: 3066 },
        { plate: '83-5345', name: 'อ.อารยะวงศ์', liters: 181, amount: 5673 },
        { plate: 'กข-195', name: 'อ.อารยะวงศ์', liters: 68.28, amount: 2140 },
        { plate: '83-6969', name: 'อ.อารยะวงศ์', liters: 150, amount: 4701 },
        { plate: '83-8624', name: 'อ.อารยะวงศ์', liters: 79.77, amount: 2500 },
        { plate: '83-1434', name: 'นายกฤษณะ ถมอินทร์', liters: 200, amount: 6268 },
        { plate: '82-0132', name: 'น.ส.ธันยนันท์ มงคลวัฒน์', liters: 200, amount: 6268 },
        { plate: '82-6000', name: 'เชษ พรหมวิหาร', liters: 146.34, amount: 5840 },
        { plate: '80-1278', name: 'นายศุภชัย งามประเสริฐ', liters: 137.84, amount: 4320 },
        { plate: 'รล-8555', name: 'สุธรรม', liters: 254, amount: 7960 },
        { plate: '70-2177', name: 'รถน้ำมัน', liters: 180, amount: 5641 },
        { plate: '80-7466', name: 'จิตกร  ตั้งโส', liters: 200, amount: 6268 },
        { plate: '81-4397', name: 'มิตรเกษตร อนันต์จำกัด', liters: 400, amount: 12536 },
        { plate: '81-4397', name: 'มิตรเกษตร อนันต์จำกัด', liters: 35.42, amount: 1110 },
        { plate: '80-9992', name: 'นายสายรุ้ง  กับแม', liters: 177.41, amount: 5560 },
    ];

    const allPaper = [...paper2, ...paper3];

    // Find matching transactions in system
    console.log('=== ตรวจสอบรายการที่ตรงกัน ===');
    let found = 0;
    let notFound = 0;

    for (const p of allPaper) {
        // Try to find matching transaction
        const match = txs.find(t => {
            const sysPlate = (t.licensePlate || '').replace(/[^0-9]/g, '');
            const paperPlate = p.plate.replace(/[^0-9]/g, '');
            const amountMatch = Math.abs(Number(t.amount) - p.amount) < 10; // Allow small diff
            return sysPlate.includes(paperPlate) && amountMatch;
        });

        if (match) {
            found++;
        } else {
            console.log(`❌ NOT FOUND: ${p.plate} | ${p.liters}L | ${p.amount} บาท | ${p.name}`);
            notFound++;
        }
    }

    console.log(`\n✅ Found in system: ${found}`);
    console.log(`❌ Not found: ${notFound}`);

    // Summary
    const paperTotal = allPaper.reduce((sum, p) => sum + p.amount, 0);
    const paperLiters = allPaper.reduce((sum, p) => sum + p.liters, 0);

    const sysCredit = txs.filter(t => t.paymentType === 'CREDIT');
    const sysTotal = sysCredit.reduce((sum, t) => sum + Number(t.amount), 0);
    const sysLiters = sysCredit.reduce((sum, t) => sum + Number(t.liters || 0), 0);

    console.log('\n=== Summary ===');
    console.log('ใบบันทึก (หน้า 2+3):', paperLiters.toFixed(2), 'ลิตร =', paperTotal.toFixed(2), 'บาท');
    console.log('ระบบ (CREDIT):', sysLiters.toFixed(2), 'ลิตร =', sysTotal.toFixed(2), 'บาท');
    console.log('ส่วนต่าง:', (sysTotal - paperTotal).toFixed(2), 'บาท');

    await prisma.$disconnect();
}

compare();
