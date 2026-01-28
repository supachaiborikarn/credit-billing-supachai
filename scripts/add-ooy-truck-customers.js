const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// รายชื่อลูกค้ากลุ่ม "รถพี่อ้อย"
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
    { name: 'อำพร', plate: '81-5745' },
    { name: 'อำพล อ่อนละมุน', plate: '83-3925' },
    { name: 'สมยศ', plate: '81-6456' },
    { name: 'สมศักดิ์', plate: '82-2807' },
    { name: 'ทวี', plate: '84-8237' },
    { name: 'วิรชัย', plate: '82-3472' },
    { name: 'อำพล', plate: '83-4372' },
];

async function seedOoyTruckCustomers() {
    console.log('🚛 เพิ่มลูกค้ากลุ่ม "รถพี่อ้อย"...\n');

    let addedOwners = 0;
    let addedTrucks = 0;
    let skippedTrucks = 0;

    for (const customer of customers) {
        try {
            // Create owner with unique name + plate combination
            const ownerName = `${customer.name} (${customer.plate})`;

            // Check if owner already exists by checking truck license plate
            const existingTruck = await prisma.truck.findFirst({
                where: { licensePlate: customer.plate }
            });

            if (existingTruck) {
                console.log(`⏭️  ข้าม: ${customer.plate} - มีในระบบแล้ว`);
                skippedTrucks++;
                continue;
            }

            // Create owner
            const owner = await prisma.owner.create({
                data: {
                    name: customer.name,
                    groupType: 'OOY_TRUCK',
                    status: 'ACTIVE',
                    creditLimit: 50000,
                    currentCredit: 0,
                }
            });
            addedOwners++;

            // Create truck linked to owner
            await prisma.truck.create({
                data: {
                    licensePlate: customer.plate,
                    ownerId: owner.id,
                }
            });
            addedTrucks++;

            console.log(`✅ เพิ่ม: ${customer.name} - ${customer.plate}`);
        } catch (error) {
            console.error(`❌ Error adding ${customer.name} (${customer.plate}):`, error.message);
        }
    }

    console.log('\n=============================');
    console.log(`📊 สรุป:`);
    console.log(`   เจ้าของใหม่: ${addedOwners} คน`);
    console.log(`   รถใหม่: ${addedTrucks} คัน`);
    console.log(`   ข้าม (มีอยู่แล้ว): ${skippedTrucks} คัน`);
    console.log('=============================\n');
}

seedOoyTruckCustomers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
