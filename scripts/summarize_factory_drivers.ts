import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: {
      owner: {
        groupType: 'BOX_TRUCK'
      },
      liters: {
        lt: 100
      },
      isVoided: false,
      deletedAt: null
    },
    include: {
      owner: true
    }
  })

  // Aggregate by owner name
  const summary: Record<string, { totalLiters: number, totalAmount: number, count: number }> = {}

  for (const t of transactions) {
    const ownerName = t.owner?.name || t.ownerName || 'ไม่ระบุชื่อ'
    if (!summary[ownerName]) {
      summary[ownerName] = { totalLiters: 0, totalAmount: 0, count: 0 }
    }
    summary[ownerName].totalLiters += Number(t.liters)
    summary[ownerName].totalAmount += Number(t.amount)
    summary[ownerName].count += 1
  }

  const sortedSummary = Object.entries(summary).sort((a, b) => b[1].totalAmount - a[1].totalAmount)

  // CSV
  const headers = ['ชื่อคนขับ (Driver)', 'จำนวนครั้งที่เติม (Count)', 'รวมจำนวนลิตร (Total Liters)', 'รวมเป็นเงิน (Total Amount)']
  const rows = sortedSummary.map(([name, data]) => {
    return [
      `"${name}"`,
      data.count,
      data.totalLiters.toFixed(2),
      data.totalAmount.toFixed(2)
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\n')
  const outputFilePath = path.join(process.cwd(), 'factory_drivers_under_100l_summary.csv')
  fs.writeFileSync(outputFilePath, '\uFEFF' + csvContent, 'utf8')

  console.log(`Exported summary for ${sortedSummary.length} drivers to ${outputFilePath}`)
  console.log('---')
  sortedSummary.forEach(([name, data]) => {
    console.log(`${name}: ${data.count} ครั้ง | ${data.totalLiters.toFixed(2)} ลิตร | ${data.totalAmount.toFixed(2)} บาท`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
