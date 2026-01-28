const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// รายชื่อลูกค้ากลุ่ม "รถพี่อ้อย" - อัปเดตชื่อและกลุ่ม
const customers = [
    { name: 'สุนทร', plate: '81-5745' },
    { name: 'สมยศ', plate: '83-8546' },
    { name: 'พลากร', plate: '82-1380' },
    { name: 'บุญเลิศ', plate: '82-3282' },
    { name: 'ประจักษ์', plate: '82-3605' },
    { name: 'นพพร', plate: '83-8700' },
    { name: 'นิกร', plate: '82-6580' },
    { name: 'สุดใจ', plate: '83-0823' },
    { name: 'นพพร', plate: '83-5346' },
    { name: 'สมยศ', plate: '81-1825' },
    { name: 'สมศักดิ์', plate: '81-4704' },
    { name: 'ต้าร์', plate: '82-7807' },
    { name: 'นิคม', plate: '82-2653' },
    { name: 'ฝ้าย', plate: '83-1086' },
    { name: 'นิคม', plate: '83-8506' },
    { name: 'วิรัตน์', plate: '80-6192' },
    { name: 'วสัน', plate: '83-5751' },
    { name: 'อำพร', plate: '81-5745' },  // ซ้ำกับสุนทร - จะข้าม
    { name: 'อำพล อ่อนละมุน', plate: '83-3925' },
    { name: 'สมยศ', plate: '81-6456' },
    { name: 'สมศักดิ์', plate: '82-2807' },
    { name: 'ทวี', plate: '84-8237' },
    { name: 'วิรชัย', plate: '82-3472' },
    { name: 'อำพล', plate: '83-4372' },
];

async function updateOoyTruckCustomers() {
    console.log('🔄 อัปเดตลูกค้าเข้ากลุ่ม "รถพี่อ้อย"...\n');

    let updated = 0;
    let notFound = 0;
    const processed = new Set(); // Track processed plates to avoid duplicates

    for (const customer of customers) {
        // Skip duplicate plates
        if (processed.has(customer.plate)) {
            console.log(`⏭️  ข้าม: ${customer.plate} - ทะเบียนซ้ำในรายการ`);
            continue;
        }
        processed.add(customer.plate);

        try {
            // Find truck by license plate
            const truck = await prisma.truck.findFirst({
                where: { licensePlate: customer.plate },
                include: { owner: true }
            });

            if (!truck) {
                console.log(`❓ ไม่พบ: ${customer.plate}`);
                notFound++;
                continue;
            }

            // Update owner name and group
            const oldName = truck.owner.name;
            const oldGroup = truck.owner.groupType;

            await prisma.owner.update({
                where: { id: truck.ownerId },
                data: {
                    name: customer.name,
                    groupType: 'OOY_TRUCK'
                }
            });

            if (oldName !== customer.name || oldGroup !== 'OOY_TRUCK') {
                console.log(`✅ อัปเดต: ${customer.plate}`);
                console.log(`   ชื่อ: "${oldName}" → "${customer.name}"`);
                console.log(`   กลุ่ม: ${oldGroup} → OOY_TRUCK`);
                updated++;
            } else {
                console.log(`⏭️  ไม่เปลี่ยน: ${customer.plate} (${customer.name}) - ข้อมูลเหมือนเดิม`);
            }
        } catch (error) {
            console.error(`❌ Error: ${customer.plate}:`, error.message);
        }
    }

    console.log('\n=============================');
    console.log(`📊 สรุป:`);
    console.log(`   อัปเดต: ${updated} รายการ`);
    console.log(`   ไม่พบ: ${notFound} รายการ`);
    console.log('=============================\n');

    // Show all OOY_TRUCK owners
    console.log('📋 รายชื่อลูกค้ากลุ่ม "รถพี่อ้อย" ทั้งหมด:');
    const ooyOwners = await prisma.owner.findMany({
        where: { groupType: 'OOY_TRUCK' },
        include: { trucks: true },
        orderBy: { name: 'asc' }
    });

    ooyOwners.forEach((owner, i) => {
        const plates = owner.trucks.map(t => t.licensePlate).join(', ');
        console.log(`   ${i + 1}. ${owner.name} - ${plates}`);
    });
    console.log(`\nรวม: ${ooyOwners.length} คน`);
}

updateOoyTruckCustomers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
