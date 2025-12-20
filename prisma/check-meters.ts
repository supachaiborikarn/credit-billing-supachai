import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMeters() {
    console.log('=== ตรวจสอบ Meter Readings ของแท๊งลอย (Station-1) ===\n');

    // Get daily record for Dec 19
    const startOfDay = new Date('2025-12-19T00:00:00+07:00');
    startOfDay.setHours(startOfDay.getHours() - 7);

    const dailyRecord = await prisma.dailyRecord.findFirst({
        where: {
            stationId: 'station-1',
            date: startOfDay
        },
        include: {
            meters: {
                orderBy: { nozzleNumber: 'asc' }
            },
            shifts: {
                include: {
                    meters: {
                        orderBy: { nozzleNumber: 'asc' }
                    }
                }
            }
        }
    });

    if (!dailyRecord) {
        console.log('ไม่พบ Daily Record สำหรับวันที่ 19 ธันวาคม');

        // Try to find any daily records
        const allRecords = await prisma.dailyRecord.findMany({
            where: { stationId: 'station-1' },
            orderBy: { date: 'desc' },
            take: 5
        });
        console.log('\nDaily Records ล่าสุด:');
        for (const r of allRecords) {
            console.log(`  ${r.date.toLocaleDateString('th-TH')} | ${r.id}`);
        }
        await prisma.$disconnect();
        return;
    }

    console.log('Daily Record ID:', dailyRecord.id);
    console.log('Date:', dailyRecord.date.toLocaleDateString('th-TH'));

    // Check meter readings directly from daily record
    console.log('\n=== Meter Readings (จาก Daily Record) ===');
    if (dailyRecord.meters.length > 0) {
        let totalDispensed = 0;
        for (const m of dailyRecord.meters) {
            const start = Number(m.startReading || 0);
            const end = Number(m.endReading || 0);
            const dispensed = end - start;
            totalDispensed += dispensed;
            console.log(`หัวจ่าย ${m.nozzleNumber}: เริ่ม ${start.toFixed(2)} -> สิ้นสุด ${end.toFixed(2)} = ${dispensed.toFixed(2)} ลิตร`);
        }
        console.log(`\nรวมจากมิเตอร์: ${totalDispensed.toFixed(2)} ลิตร`);
    } else {
        console.log('ไม่พบ meter readings ใน daily record');
    }

    // Check shift meter readings
    console.log('\n=== Meter Readings (จาก Shifts) ===');
    for (const shift of dailyRecord.shifts) {
        console.log(`\nShift ${shift.shiftNumber}:`);
        if (shift.meters.length > 0) {
            for (const m of shift.meters) {
                const start = Number(m.startReading || 0);
                const end = Number(m.endReading || 0);
                const dispensed = end - start;
                console.log(`  หัวจ่าย ${m.nozzleNumber}: ${start.toFixed(2)} -> ${end.toFixed(2)} = ${dispensed.toFixed(2)} ลิตร`);
            }
        } else {
            console.log('  ไม่พบ meter readings');
        }
    }

    // Get all meter readings for station-1
    console.log('\n=== ค้นหา Meter Readings ทั้งหมดของ Station-1 ===');
    const allMeters = await prisma.meterReading.findMany({
        where: {
            dailyRecord: { stationId: 'station-1' }
        },
        include: {
            dailyRecord: { select: { date: true } }
        },
        orderBy: [
            { dailyRecord: { date: 'desc' } },
            { nozzleNumber: 'asc' }
        ],
        take: 20
    });

    console.log('Total meter readings found:', allMeters.length);
    for (const m of allMeters) {
        const date = m.dailyRecord?.date?.toLocaleDateString('th-TH') || 'N/A';
        console.log(`  ${date} | หัวจ่าย ${m.nozzleNumber} | ${Number(m.startReading).toFixed(2)} -> ${Number(m.endReading || 0).toFixed(2)}`);
    }

    await prisma.$disconnect();
}

checkMeters();
