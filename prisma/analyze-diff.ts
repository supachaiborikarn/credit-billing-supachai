import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function analyze() {
    console.log('=== วิเคราะห์ส่วนต่าง 600 ลิตร ===\n');

    const startOfDay = new Date('2025-12-19T00:00:00+07:00');
    startOfDay.setHours(startOfDay.getHours() - 7);

    const endOfDay = new Date('2025-12-19T23:59:59+07:00');
    endOfDay.setHours(endOfDay.getHours() - 7);

    // Get all transactions
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
            productType: true,
            billBookNo: true,
            billNo: true,
        },
        orderBy: { date: 'asc' }
    });

    // Calculate totals by payment type
    const grouped: { [key: string]: { count: number, liters: number, amount: number } } = {};

    for (const t of txs) {
        const type = t.paymentType;
        if (!grouped[type]) {
            grouped[type] = { count: 0, liters: 0, amount: 0 };
        }
        grouped[type].count++;
        grouped[type].liters += Number(t.liters || 0);
        grouped[type].amount += Number(t.amount);
    }

    console.log('=== สรุปตามประเภทการชำระ ===');
    let totalLiters = 0;
    for (const [type, data] of Object.entries(grouped)) {
        console.log(`${type.padEnd(12)}: ${data.count} รายการ | ${data.liters.toFixed(2)} ลิตร | ${data.amount.toFixed(2)} บาท`);
        totalLiters += data.liters;
    }
    console.log(`\nรวมลิตรในระบบ: ${totalLiters.toFixed(2)} ลิตร`);

    // Check for potential issues
    console.log('\n=== สาเหตุที่เป็นไปได้ของส่วนต่าง 600 ลิตร ===\n');

    // 1. Check for duplicate entries (same plate, same amount, same day)
    console.log('1. ตรวจหารายการซ้ำ (ทะเบียนเดียวกัน ยอดเดียวกัน):');
    const seen = new Map<string, typeof txs>();
    const duplicates = [];

    for (const t of txs) {
        const key = `${t.licensePlate}-${t.liters}-${t.amount}`;
        if (seen.has(key)) {
            duplicates.push({ tx1: seen.get(key)![0], tx2: t, key });
            seen.get(key)!.push(t);
        } else {
            seen.set(key, [t]);
        }
    }

    const realDuplicates = [...seen.entries()].filter(([_, arr]) => arr.length > 1);
    if (realDuplicates.length > 0) {
        let dupLiters = 0;
        for (const [key, arr] of realDuplicates) {
            const extraCount = arr.length - 1;
            const liters = Number(arr[0].liters || 0);
            dupLiters += liters * extraCount;
            console.log(`   ⚠️ ${arr[0].licensePlate} | ${liters} ลิตร | ${arr[0].amount} บาท - พบ ${arr.length} ครั้ง (+${liters * extraCount} ลิตร)`);
        }
        console.log(`   รวมลิตรที่อาจซ้ำ: ${dupLiters.toFixed(2)} ลิตร`);
    } else {
        console.log('   ไม่พบรายการซ้ำที่ชัดเจน');
    }

    // 2. Check for transactions with high liters
    console.log('\n2. รายการที่มีลิตรสูงผิดปกติ (> 500 ลิตร):');
    const highLiters = txs.filter(t => Number(t.liters || 0) > 500);
    if (highLiters.length > 0) {
        for (const t of highLiters) {
            console.log(`   ${t.licensePlate?.padEnd(15)} | ${Number(t.liters).toFixed(2)} ลิตร | ${t.ownerName?.substring(0, 15)} | ${t.paymentType}`);
        }
    } else {
        console.log('   ไม่พบ');
    }

    // 3. Check BOX_TRUCK transactions (รถน้ำมัน)
    console.log('\n3. รายการรถน้ำมัน (BOX_TRUCK) - อาจบันทึกผิดพลาด:');
    const boxTruck = txs.filter(t => t.paymentType === 'BOX_TRUCK');
    let boxTotal = 0;
    for (const t of boxTruck) {
        const liters = Number(t.liters || 0);
        boxTotal += liters;
        console.log(`   ${t.licensePlate?.padEnd(15)} | ${liters.toFixed(2)} ลิตร | ${t.ownerName}`);
    }
    console.log(`   รวม BOX_TRUCK: ${boxTotal.toFixed(2)} ลิตร`);

    // 4. Check for transactions without liters
    console.log('\n4. รายการที่ไม่มีจำนวนลิตร (liters = 0 หรือ null):');
    const noLiters = txs.filter(t => !t.liters || Number(t.liters) === 0);
    if (noLiters.length > 0) {
        for (const t of noLiters) {
            console.log(`   ${t.licensePlate?.padEnd(15)} | ${Number(t.amount)} บาท | ${t.ownerName?.substring(0, 15)}`);
        }
        console.log(`   พบ ${noLiters.length} รายการที่ไม่มีลิตร`);
    } else {
        console.log('   ไม่พบ');
    }

    // 5. Check different price per liter
    console.log('\n5. ตรวจสอบราคาต่อลิตร:');
    const priceCheck = txs.filter(t => Number(t.liters) > 0).map(t => ({
        plate: t.licensePlate,
        liters: Number(t.liters),
        amount: Number(t.amount),
        pricePerLiter: Number(t.amount) / Number(t.liters)
    }));

    const abnormalPrice = priceCheck.filter(p => p.pricePerLiter < 25 || p.pricePerLiter > 35);
    if (abnormalPrice.length > 0) {
        console.log('   รายการที่ราคาผิดปกติ:');
        for (const p of abnormalPrice) {
            console.log(`   ${p.plate?.padEnd(15)} | ${p.liters.toFixed(2)} L | ${p.amount.toFixed(2)} บาท | ราคา ${p.pricePerLiter.toFixed(2)} บ/ลิตร`);
        }
    } else {
        console.log('   ราคาปกติทั้งหมด (25-35 บาท/ลิตร)');
    }

    await prisma.$disconnect();
}

analyze();
