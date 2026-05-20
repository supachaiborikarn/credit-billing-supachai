import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const owners = await prisma.owner.findMany({
    where: {
      OR: [
        { name: { contains: 'ไผ่' } },
        { name: { contains: 'แถม' } },
      ]
    }
  })
  console.log("Owners with 'ไผ่', 'แถม':", owners)
}

main().catch(console.error).finally(() => prisma.$disconnect())
