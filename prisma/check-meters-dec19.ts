import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMeters() {
    console.log('=== ตรวจสอบ Meter Readings ของแท๊งลอย (Station-1) วันที่ 19 ===\n');

    // Use the daily record ID found
    const dailyRecordId = 'd3cf6305-3896-4de3-9115-90efa85e4d2e';

    const dailyRecord = await prisma.dailyRecord.findUnique({
        where: { id: dailyRecordId },
        include: {
            meters: {
                orderBy: { nozzleNumber: 'asc' }
            },
            shifts: {
                include: {
                    meters: {
                        orderBy: { nozzleNumber: 'asc' }
                    }
                },
                orderBy: { shiftNumber: 'asc' }
            }
        }
    });

    if (!dailyRecord) {
        console.log('ไม่พบ Daily Record');
        await prisma.$disconnect();
        return;
    }

    console.log('Daily Record ID:', dailyRecord.id);
    console.log('Date:', dailyRecord.date.toLocaleDateString('th-TH'));
    console.log('Station:', dailyRecord.stationId);

    // Check meter readings from daily record
    console.log('\n=== Meter Readings (จาก Daily Record) ===');
    if (dailyRecord.meters.length > 0) {
        let totalDispensed = 0;
        for (const m of dailyRecord.meters) {
            const start = Number(m.startReading || 0);
            const end = Number(m.endReading || 0);
            const dispensed = end - start;
            totalDispensed += dispensed > 0 ? dispensed : 0;
            console.log(`หัวจ่าย ${m.nozzleNumber}: เริ่ม ${start.toFixed(2)} -> สิ้นสุด ${end.toFixed(2)} = ${dispensed.toFixed(2)} ลิตร`);
        }
        console.log(`\nรวมจากมิเตอร์: ${totalDispensed.toFixed(2)} ลิตร`);
    } else {
        console.log('ไม่พบ meter readings ใน daily record');
    }

    // Check shifts
    console.log('\n=== Shifts ===');
    console.log('Total shifts:', dailyRecord.shifts.length);

    for (const shift of dailyRecord.shifts) {
        console.log(`\n--- Shift ${shift.shiftNumber} ---`);
        console.log(`  ID: ${shift.id}`);
        console.log(`  Status: ${shift.status}`);
        console.log(`  Meters: ${shift.meters.length}`);

        if (shift.meters.length > 0) {
            let shiftTotal = 0;
            for (const m of shift.meters) {
                const start = Number(m.startReading || 0);
                const end = Number(m.endReading || 0);
                const dispensed = end - start;
                shiftTotal += dispensed > 0 ? dispensed : 0;
                console.log(`    หัวจ่าย ${m.nozzleNumber}: ${start.toFixed(2)} -> ${end.toFixed(2)} = ${dispensed.toFixed(2)} ลิตร`);
            }
            console.log(`  รวม Shift ${shift.shiftNumber}: ${shiftTotal.toFixed(2)} ลิตร`);
        }
    }

    // Get transactions for comparison
    console.log('\n=== เปรียบเทียบกับ Transactions ===');

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
        select: { liters: true, paymentType: true }
    });

    const txTotal = txs.reduce((sum, t) => sum + Number(t.liters || 0), 0);
    console.log('รวมลิตรจาก Transactions:', txTotal.toFixed(2), 'ลิตร');

    // Meter total from daily record
    const meterTotal = dailyRecord.meters.reduce((sum, m) => {
        const dispensed = Number(m.endReading || 0) - Number(m.startReading || 0);
        return sum + (dispensed > 0 ? dispensed : 0);
    }, 0);

    console.log('\n=== ส่วนต่าง ===');
    console.log('มิเตอร์:', meterTotal.toFixed(2), 'ลิตร');
    console.log('Transactions:', txTotal.toFixed(2), 'ลิตร');
    console.log('ส่วนต่าง:', (txTotal - meterTotal).toFixed(2), 'ลิตร', txTotal > meterTotal ? '(Tx มากกว่า)' : '(มิเตอร์มากกว่า)');

    await prisma.$disconnect();
}

checkMeters();
