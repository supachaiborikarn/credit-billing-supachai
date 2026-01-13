import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Delete old anomalies that were calculated incorrectly
  console.log('Deleting old incorrect anomalies...')
  await prisma.dailyAnomaly.deleteMany({
    where: { stationId: 'station-1' }
  })
  console.log('Done!')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
