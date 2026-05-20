import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  // Query all transactions for BOX_TRUCK owners where liters < 100
  // Order by date ascending since they want "from the beginning"
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
      owner: true,
      station: true
    },
    orderBy: {
      date: 'asc'
    }
  })

  // Prepare CSV content
  const headers = ['วันที่ (Date)', 'สถานี (Station)', 'ชื่อคนขับ (Driver)', 'ทะเบียนรถ (License Plate)', 'ประเภทน้ำมัน (Product)', 'ลิตร (Liters)', 'ราคา/ลิตร (Price/Liter)', 'จำนวนเงิน (Amount)', 'เลขบิล (Bill No)']
  
  const rows = transactions.map(t => {
    // Formatting date to Thai locale roughly
    const dateStr = t.date ? new Date(t.date).toLocaleString('th-TH') : ''
    const stationName = t.station?.name || ''
    const ownerName = t.owner?.name || t.ownerName || ''
    const licensePlate = t.licensePlate || ''
    const product = t.productType || ''
    const liters = Number(t.liters).toFixed(2)
    const pricePerLiter = Number(t.pricePerLiter).toFixed(2)
    const amount = Number(t.amount).toFixed(2)
    const billNo = t.billNo || ''

    return [
      `"${dateStr}"`,
      `"${stationName}"`,
      `"${ownerName}"`,
      `"${licensePlate}"`,
      `"${product}"`,
      liters,
      pricePerLiter,
      amount,
      `"${billNo}"`
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\n')
  
  // Writing CSV file with BOM for Excel compatibility in Thai
  const outputFilePath = path.join(process.cwd(), 'factory_drivers_under_100l_bills.csv')
  fs.writeFileSync(outputFilePath, '\uFEFF' + csvContent, 'utf8')
  
  console.log(`Exported ${transactions.length} records to ${outputFilePath}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
