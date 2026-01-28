const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// รายชื่อลูกค้ากลุ่ม "รถพี่อ้อย"
// เจ้าของคนเดียวกันสามารถมีหลายคันได้
const customers = [
    { name: 'สุนทร', plate: '81-5745' },
    { name: 'สมยศ', plate: '83-8546' },
    { name: 'พลากร', plate: '82-1380' },
    { name: 'บุญเลิศ', plate: '82-3282' },
    { name: 'ประจักษ์', plate: '82-3605' },
    { name: 'นพพร', plate: '83-8700' },
    { name: 'นิกร', plate: '82-6580' },
    { name: 'สุดใจ', plate: '83-0823' },
    { name: 'นพพร', plate: '83-5346' },  // นพพร คนที่ 2
    { name: 'สมยศ', plate: '81-1825' },  // สมยศ คนที่ 2
    { name: 'สมศักดิ์', plate: '81-4704' },
    { name: 'ต้าร์', plate: '82-7807' },
    { name: 'นิคม', plate: '82-2653' },
    { name: 'ฝ้าย', plate: '83-1086' },
    { name: 'นิคม', plate: '83-8506' },  // นิคม คนที่ 2
    { name: 'วิรัตน์', plate: '80-6192' },
    { name: 'วสัน', plate: '83-5751' },
    { name: 'อำพร', plate: '81-5745' },  // ทะเบียนซ้ำกับสุนทร - ใช้คนละเจ้าของ? (ข้าม)
    { name: 'อำพล อ่อนละมุน', plate: '83-3925' },
    { name: 'สมยศ', plate: '81-6456' },  // สมยศ คนที่ 3
    { name: 'สมศักดิ์', plate: '82-2807' },  // สมศักดิ์ คนที่ 2
    { name: 'ทวี', plate: '84-8237' },
    { name: 'วิรชัย', plate: '82-3472' },
    { name: 'อำพล', plate: '83-4372' },
];

async function fixOoyTruckCustomers() {
    console.log('🔄 แก้ไขลูกค้ากลุ่ม "รถพี่อ้อย" - เจ้าของคนเดียวหลายคัน...\n');

    // Step 1: Group trucks by owner name
    const ownerTrucks = {};
    const duplicatePlates = new Set();

    for (const c of customers) {
        // Check for duplicate plates
        if (customers.filter(x => x.plate === c.plate).length > 1) {
            duplicatePlates.add(c.plate);
        }

        if (!ownerTrucks[c.name]) {
            ownerTrucks[c.name] = [];
        }
        if (!ownerTrucks[c.name].includes(c.plate)) {
            ownerTrucks[c.name].push(c.plate);
        }
    }

    console.log('📋 กลุ่มเจ้าของและรถ:');
    for (const [name, plates] of Object.entries(ownerTrucks)) {
        console.log(`   ${name}: ${plates.join(', ')} (${plates.length} คัน)`);
    }
    console.log('');

    if (duplicatePlates.size > 0) {
        console.log(`⚠️  ทะเบียนซ้ำในรายการ: ${Array.from(duplicatePlates).join(', ')}\n`);
    }

    // Step 2: Process each owner
    let ownersCreated = 0;
    let ownersUpdated = 0;
    let trucksCreated = 0;
    let trucksUpdated = 0;

    for (const [ownerName, plates] of Object.entries(ownerTrucks)) {
        console.log(`\n👤 ${ownerName} (${plates.length} คัน: ${plates.join(', ')})`);

        // Find or create owner with this name in OOY_TRUCK group
        let owner = await prisma.owner.findFirst({
            where: {
                name: ownerName,
                groupType: 'OOY_TRUCK'
            }
        });

        if (!owner) {
            // Create new owner
            owner = await prisma.owner.create({
                data: {
                    name: ownerName,
                    groupType: 'OOY_TRUCK',
                    status: 'ACTIVE',
                    creditLimit: 50000,
                    currentCredit: 0,
                }
            });
            console.log(`   ✅ สร้างเจ้าของใหม่: ${ownerName}`);
            ownersCreated++;
        } else {
            console.log(`   ⏭️  เจ้าของมีอยู่แล้ว: ${ownerName}`);
            ownersUpdated++;
        }

        // Process each truck for this owner
        for (const plate of plates) {
            let truck = await prisma.truck.findFirst({
                where: { licensePlate: plate }
            });

            if (!truck) {
                // Create new truck
                await prisma.truck.create({
                    data: {
                        licensePlate: plate,
                        ownerId: owner.id,
                    }
                });
                console.log(`   ✅ สร้างรถใหม่: ${plate}`);
                trucksCreated++;
            } else if (truck.ownerId !== owner.id) {
                // Update truck's owner
                const oldOwner = await prisma.owner.findUnique({ where: { id: truck.ownerId } });
                await prisma.truck.update({
                    where: { id: truck.id },
                    data: { ownerId: owner.id }
                });
                console.log(`   🔄 ย้ายรถ ${plate} จาก "${oldOwner?.name}" → "${ownerName}"`);
                trucksUpdated++;
            } else {
                console.log(`   ⏭️  รถ ${plate} อยู่กับเจ้าของถูกต้องแล้ว`);
            }
        }
    }

    console.log('\n=============================');
    console.log(`📊 สรุป:`);
    console.log(`   เจ้าของใหม่: ${ownersCreated} คน`);
    console.log(`   เจ้าของที่มีอยู่: ${ownersUpdated} คน`);
    console.log(`   รถใหม่: ${trucksCreated} คัน`);
    console.log(`   รถที่ย้ายเจ้าของ: ${trucksUpdated} คัน`);
    console.log('=============================\n');

    // Show final result
    console.log('📋 รายชื่อกลุ่ม "รถพี่อ้อย" (OOY_TRUCK) สุดท้าย:\n');
    const ooyOwners = await prisma.owner.findMany({
        where: { groupType: 'OOY_TRUCK', deletedAt: null },
        include: { trucks: { where: { deletedAt: null } } },
        orderBy: { name: 'asc' }
    });

    ooyOwners.forEach((owner, i) => {
        const plates = owner.trucks.map(t => t.licensePlate).join(', ');
        console.log(`${i + 1}. ${owner.name}`);
        console.log(`   🚛 ${plates || '(ไม่มีรถ)'}`);
    });
    console.log(`\n✅ รวม: ${ooyOwners.length} คน, ${ooyOwners.reduce((sum, o) => sum + o.trucks.length, 0)} คัน`);
}

fixOoyTruckCustomers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
