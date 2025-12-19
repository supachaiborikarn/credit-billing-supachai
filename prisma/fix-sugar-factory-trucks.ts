import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ข้อมูลที่ถูกต้องจากผู้ใช้
const CORRECT_DATA = [
    { ownerName: 'นายกฤษณะ ถมอินทร์', licensePlate: 'กพ83-0450', code: 'C227' },
    { ownerName: 'น.ส.เบญลักษณ์ สุดมี', licensePlate: 'กพ82-6905', code: 'C142' },
    { ownerName: 'น.ส.ประยงค์ ทับทิม', licensePlate: 'กพ83-4026', code: 'C298' },
    { ownerName: 'นายณัฐพล แย้มสะอาด', licensePlate: 'กพ82-5336', code: 'C165' },
    { ownerName: 'นายภิรมย์ จงมีความสุข', licensePlate: 'กพ82-1755', code: 'C162' },
];

async function main() {
    console.log('🔄 กำลังแก้ไขข้อมูลรถร่วมโรงงาน...\n');

    for (const data of CORRECT_DATA) {
        console.log(`\n📍 แก้ไข: ${data.licensePlate} → ${data.ownerName} [${data.code}]`);

        // 1. หารถจากทะเบียน
        const truck = await prisma.truck.findFirst({
            where: {
                licensePlate: { contains: data.licensePlate.replace('กพ', '') }
            },
            include: { owner: true }
        });

        if (!truck) {
            console.log(`  ⚠️ ไม่พบรถทะเบียน ${data.licensePlate}`);
            continue;
        }

        console.log(`  📋 พบรถ: ${truck.licensePlate}`);
        console.log(`  📋 เจ้าของปัจจุบัน: ${truck.owner?.name || 'ไม่มี'} [${truck.owner?.code || '-'}]`);

        // 2. หา Owner ที่มี code ตรง หรือสร้างใหม่
        let targetOwner = await prisma.owner.findFirst({
            where: { code: data.code }
        });

        if (targetOwner) {
            // ถ้ามี owner ที่มี code นี้แล้ว - อัปเดตชื่อถ้าต่างกัน
            if (targetOwner.name !== data.ownerName) {
                console.log(`  🔄 อัปเดตชื่อ Owner ${data.code}: "${targetOwner.name}" → "${data.ownerName}"`);
                targetOwner = await prisma.owner.update({
                    where: { id: targetOwner.id },
                    data: { name: data.ownerName }
                });
            }
        } else {
            // ถ้าไม่มี - สร้าง Owner ใหม่
            console.log(`  ➕ สร้าง Owner ใหม่: ${data.ownerName} [${data.code}]`);
            targetOwner = await prisma.owner.create({
                data: {
                    name: data.ownerName,
                    code: data.code,
                    groupType: 'SUGAR_FACTORY'
                }
            });
        }

        // 3. ย้ายรถไปยัง Owner ที่ถูกต้อง
        if (truck.ownerId !== targetOwner.id) {
            await prisma.truck.update({
                where: { id: truck.id },
                data: { ownerId: targetOwner.id }
            });
            console.log(`  ✅ ย้ายรถไปยัง: ${targetOwner.name} [${targetOwner.code}]`);
        } else {
            console.log(`  ✅ รถอยู่กับเจ้าของที่ถูกต้องแล้ว`);
        }
    }

    console.log('\n\n🎉 เสร็จสิ้น! ตรวจสอบผลลัพธ์:');

    // แสดงผลลัพธ์
    for (const data of CORRECT_DATA) {
        const truck = await prisma.truck.findFirst({
            where: { licensePlate: { contains: data.licensePlate.replace('กพ', '') } },
            include: { owner: true }
        });

        if (truck) {
            const isCorrect = truck.owner?.code === data.code;
            console.log(`  ${isCorrect ? '✅' : '❌'} ${truck.licensePlate} → ${truck.owner?.name || '-'} [${truck.owner?.code || '-'}]`);
        }
    }
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
