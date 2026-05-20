import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const owners = await prisma.owner.findMany({
    where: {
      OR: [
        { name: { contains: 'ไผ่' } },
        { name: { contains: 'แถม' } },
        { groupType: 'SUGAR_FACTORY' }
      ]
    }
  })
  console.log("Owners with 'ไผ่', 'แถม' or SUGAR_FACTORY:", owners.map(o => ({ id: o.id, name: o.name, group: o.groupType })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
