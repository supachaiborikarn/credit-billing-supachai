import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const stationId = 'station-1' // แท๊งลอย

  console.log('\n=== Checking meter vs transactions for แท๊งลอย ===')

  // Get recent daily records with shifts
  const dailyRecords = await prisma.dailyRecord.findMany({
    where: { stationId },
    take: 10,
    orderBy: { date: 'desc' },
    include: {
      shifts: {
        include: {
          meters: true,
          anomalies: true
        }
      }
    }
  })

  console.log(`\nDaily records: ${dailyRecords.length}`)

  for (const dr of dailyRecords) {
    console.log(`\n📅 ${dr.date.toISOString().split('T')[0]}`)
    console.log(`  Shifts: ${dr.shifts.length}`)

    for (const shift of dr.shifts) {
      // Meter total
      const meterTotal = shift.meters.reduce((sum, m) => sum + Number(m.soldQty || 0), 0)

      // Transaction total for this day
      const transactions = await prisma.transaction.findMany({
        where: {
          dailyRecordId: dr.id,
          isVoided: { not: true }
        },
        select: { liters: true }
      })
      const transTotal = transactions.reduce((sum, t) => sum + Number(t.liters || 0), 0)

      const diff = transTotal - meterTotal

      console.log(`    Shift ${shift.shiftNumber}:`)
      console.log(`      Meter total: ${meterTotal.toFixed(2)} L`)
      console.log(`      Trans total: ${transTotal.toFixed(2)} L`)
      console.log(`      Diff: ${diff.toFixed(2)} L ${Math.abs(diff) >= 1 ? '⚠️' : '✅'}`)
      console.log(`      Anomalies saved: ${shift.anomalies.length}`)
    }
  }

  // Check if any MeterAnomaly exists for station-1
  console.log('\n=== Existing anomalies for station-1 ===')
  const anomalies = await prisma.meterAnomaly.findMany({
    where: {
      shift: {
        dailyRecord: { stationId }
      }
    },
    take: 10
  })
  console.log(`Total anomalies: ${anomalies.length}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
