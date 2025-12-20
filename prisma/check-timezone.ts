import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTimezone() {
    console.log('=== ตรวจสอบ Timezone ของ Transactions วันที่ 19 ===\n');

    // Get ALL transactions for station-1 around Dec 19
    const txs = await prisma.transaction.findMany({
        where: {
            stationId: 'station-1',
            deletedAt: null,
        },
        select: {
            id: true,
            date: true,
            createdAt: true,
            licensePlate: true,
            ownerName: true,
            liters: true,
            amount: true,
            paymentType: true,
        },
        orderBy: { date: 'asc' }
    });

    console.log('Total transactions for station-1:', txs.length);

    // Group by Bangkok date
    const byDate: { [key: string]: typeof txs } = {};

    for (const t of txs) {
        // Convert to Bangkok timezone
        const bangkokDate = new Date(t.date.getTime() + 7 * 60 * 60 * 1000);
        const dateStr = bangkokDate.toISOString().split('T')[0];

        if (!byDate[dateStr]) {
            byDate[dateStr] = [];
        }
        byDate[dateStr].push(t);
    }

    console.log('\n=== Transactions แยกตามวัน (Bangkok timezone) ===');
    for (const [date, items] of Object.entries(byDate).sort()) {
        const totalLiters = items.reduce((sum, t) => sum + Number(t.liters || 0), 0);
        const boxTruck = items.filter(t => t.paymentType === 'BOX_TRUCK');
        const boxLiters = boxTruck.reduce((sum, t) => sum + Number(t.liters || 0), 0);
        console.log(`${date}: ${items.length} รายการ | ${totalLiters.toFixed(2)} ลิตร (BOX_TRUCK: ${boxLiters.toFixed(2)} ลิตร)`);
    }

    // Check Dec 19 specifically
    console.log('\n=== รายละเอียดวันที่ 19 ธันวาคม ===');
    const dec19 = byDate['2025-12-19'] || [];
    console.log('จำนวน transactions:', dec19.length);

    // Show first and last transaction times
    if (dec19.length > 0) {
        const first = dec19[0];
        const last = dec19[dec19.length - 1];

        console.log('\nรายการแรก:');
        console.log(`  UTC: ${first.date.toISOString()}`);
        console.log(`  Bangkok: ${new Date(first.date.getTime() + 7 * 60 * 60 * 1000).toLocaleString('th-TH')}`);
        console.log(`  ${first.licensePlate} | ${first.ownerName} | ${first.paymentType}`);

        console.log('\nรายการสุดท้าย:');
        console.log(`  UTC: ${last.date.toISOString()}`);
        console.log(`  Bangkok: ${new Date(last.date.getTime() + 7 * 60 * 60 * 1000).toLocaleString('th-TH')}`);
        console.log(`  ${last.licensePlate} | ${last.ownerName} | ${last.paymentType}`);
    }

    // Check for transactions that might have wrong date
    console.log('\n=== ตรวจหา transactions ที่อาจข้ามวัน ===');
    const dec19Txs = dec19;
    const suspicious: typeof txs = [];

    for (const t of dec19Txs) {
        const utcHour = t.date.getUTCHours();
        // Bangkok midnight = UTC 17:00 previous day
        // Bangkok 23:59 = UTC 16:59 same day
        // So valid UTC times for Bangkok Dec 19 are: Dec 18 17:00 to Dec 19 16:59
        // OR equivalently: UTC hour 17-23 on Dec 18, or UTC hour 0-16 on Dec 19

        const utcDate = t.date.toISOString().split('T')[0];
        if (utcDate === '2025-12-19' && utcHour >= 17) {
            // This is actually Dec 20 in Bangkok
            suspicious.push(t);
        }
    }

    if (suspicious.length > 0) {
        console.log('⚠️ พบ transactions ที่อาจเป็นของวันที่ 20:');
        for (const t of suspicious) {
            console.log(`  ${t.date.toISOString()} | ${t.licensePlate} | ${Number(t.liters).toFixed(2)} ลิตร`);
        }
    } else {
        console.log('✅ ไม่พบ transactions ที่ข้ามวัน');
    }

    // Summary for Dec 19
    console.log('\n=== สรุปวันที่ 19 (Bangkok timezone) ===');
    const dec19Liters = dec19.reduce((sum, t) => sum + Number(t.liters || 0), 0);
    const dec19BoxTruck = dec19.filter(t => t.paymentType === 'BOX_TRUCK');
    const dec19BoxLiters = dec19BoxTruck.reduce((sum, t) => sum + Number(t.liters || 0), 0);
    const dec19OtherLiters = dec19Liters - dec19BoxLiters;

    console.log('รวมทั้งหมด:', dec19Liters.toFixed(2), 'ลิตร');
    console.log('BOX_TRUCK:', dec19BoxLiters.toFixed(2), 'ลิตร');
    console.log('อื่นๆ (CASH/CREDIT/TRANSFER):', dec19OtherLiters.toFixed(2), 'ลิตร');

    // List BOX_TRUCK
    console.log('\n=== รายการ BOX_TRUCK วันที่ 19 ===');
    for (const t of dec19BoxTruck) {
        const bangkokTime = new Date(t.date.getTime() + 7 * 60 * 60 * 1000);
        const timeStr = bangkokTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        console.log(`  ${timeStr} | ${t.licensePlate?.padEnd(12)} | ${Number(t.liters).toFixed(2).padStart(10)} ลิตร | ${t.ownerName}`);
    }

    await prisma.$disconnect();
}

checkTimezone();
