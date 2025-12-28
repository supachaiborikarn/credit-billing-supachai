import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// รายการสินค้าจากใบส่งกะ (วัชรเกียรติ)
const PRODUCTS = [
    // น้ำมันเครื่อง
    { name: 'พาวเวอร์ 2T', unit: 'ขวด', salePrice: 80 },
    { name: 'พาวเวอร์ 4T', unit: 'ขวด', salePrice: 180 },
    { name: 'ซุปเปอร์ดีเซล 1 ลิตร', unit: 'ขวด', salePrice: 135 },
    { name: 'ซุปเปอร์ดีเซล 5 ลิตร', unit: 'แกลลอน', salePrice: 560 },
    { name: 'ซิลเวอร์ 1 ลิตร', unit: 'ขวด', salePrice: 170 },
    { name: 'ซิลเวอร์ 6 ลิตร', unit: 'แกลลอน', salePrice: 950 },
    { name: 'เดโสโกลด์ 1 ลิตร', unit: 'ขวด', salePrice: 190 },
    { name: 'เดโสโกลด์ 6 ลิตร', unit: 'แกลลอน', salePrice: 1200 },
    { name: 'เดโสสปอร์ต 1 ลิตร', unit: 'ขวด', salePrice: 210 },
    { name: 'เดโสสปอร์ต 6 ลิตร', unit: 'แกลลอน', salePrice: 1200 },
    { name: 'ไฮโร่ทอง', unit: 'ขวด', salePrice: 330 },
    { name: 'เกียร์ S&P 5L', unit: 'แกลลอน', salePrice: 1100 },

    // น้ำมันอื่นๆ
    { name: 'SF', unit: 'ขวด', salePrice: 170 },
    { name: 'เกียร์ทหารอบ', unit: 'ขวด', salePrice: 220 },
    { name: 'เบรก 0.5 ลิตร', unit: 'ขวด', salePrice: 150 },
    { name: 'น้ำกลั่นแดง', unit: 'ขวด', salePrice: 25 },
    { name: 'สีน้ำ 4T 120', unit: 'ขวด', salePrice: 120 },
    { name: 'ฟิกส์', unit: 'ขวด', salePrice: 43 },
    { name: 'STP', unit: 'ขวด', salePrice: 150 },
    { name: 'ถังหลัก', unit: 'ชิ้น', salePrice: 500 },
    { name: 'ถังพลาสติก', unit: 'ใบ', salePrice: 600 },
    { name: 'หมอนน้ำ', unit: 'ชิ้น', salePrice: 215 },
    { name: 'หัวเชื้อดีเซล', unit: 'ขวด', salePrice: 290 },
    { name: 'น้าอะมิเนติล', unit: 'แกลลอน', salePrice: 210 },
];

// สถานีที่ต้องเพิ่มสินค้า
const STATIONS = [
    'station-1', // แท๊งลอยวัชรเกียรติ
    'station-2', // วัชรเกียรติออยล์
    'station-3', // ท่าน้ำมัน
    'station-4', // ศุภชัยบริการ
];

async function main() {
    console.log('🛒 Adding products to database...\n');

    for (const product of PRODUCTS) {
        // Create or update product
        const created = await prisma.product.upsert({
            where: {
                id: `product-${product.name.replace(/\s+/g, '-').toLowerCase()}`
            },
            create: {
                id: `product-${product.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: product.name,
                unit: product.unit,
                salePrice: product.salePrice
            },
            update: {
                name: product.name,
                unit: product.unit,
                salePrice: product.salePrice
            }
        });

        console.log(`✅ ${created.name} - ${created.salePrice} บาท`);

        // Add inventory for each station
        for (const stationId of STATIONS) {
            try {
                await prisma.productInventory.upsert({
                    where: {
                        productId_stationId: {
                            productId: created.id,
                            stationId
                        }
                    },
                    create: {
                        productId: created.id,
                        stationId,
                        quantity: 10, // Default stock
                        alertLevel: 3
                    },
                    update: {} // Don't update if exists
                });
            } catch {
                // Station might not exist
            }
        }
    }

    console.log(`\n✅ Done! Added ${PRODUCTS.length} products.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
