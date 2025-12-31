import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fuelProducts = [
  { name: 'ดีเซล', code: 'DIESEL' },
  { name: 'แก๊สโซฮอล์ 91', code: 'GASOHOL_91' },
  { name: 'แก๊สโซฮอล์ 95', code: 'GASOHOL_95' },
  { name: 'E20', code: 'E20' },
  { name: 'E85', code: 'E85' },
  { name: 'LPG', code: 'LPG' },
];

async function main() {
  console.log('🔧 Seeding FuelProducts...');

  for (const product of fuelProducts) {
    const existing = await prisma.fuelProduct.findUnique({
      where: { code: product.code },
    });

    if (!existing) {
      await prisma.fuelProduct.create({
        data: product,
      });
      console.log(`  ✅ Created: ${product.name}`);
    } else {
      console.log(`  ⏭️  Skipped (exists): ${product.name}`);
    }
  }

  console.log('✨ FuelProducts seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding FuelProducts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
