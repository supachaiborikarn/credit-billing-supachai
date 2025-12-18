import { prisma } from '../src/lib/prisma';
import { getStartOfDayBangkok, getEndOfDayBangkok } from '../src/lib/date-utils';

async function main() {
    const stationId = 'station-4';
    const dateStr = '2025-12-18';
    
    const startOfDay = getStartOfDayBangkok(dateStr);
    const endOfDay = getEndOfDayBangkok(dateStr);
    
    console.log('=== QUERY TEST FOR STATION-4 ===');
    console.log('Date:', dateStr);
    console.log('startOfDay:', startOfDay.toISOString());
    console.log('endOfDay:', endOfDay.toISOString());
    
    console.log('\n=== TRANSACTIONS QUERY ===');
    const transactions = await prisma.transaction.findMany({
        where: {
            stationId,
            date: { gte: startOfDay, lte: endOfDay }
        },
        orderBy: { date: 'asc' },
        include: {
            owner: { select: { name: true, code: true } },
            truck: { select: { licensePlate: true } },
            recordedBy: { select: { name: true } }
        }
    });
    
    console.log('Found:', transactions.length, 'transactions');
    transactions.forEach(t => {
        console.log(`  ${t.date.toISOString()} | ${t.licensePlate} | ${t.amount} | ${t.recordedBy?.name || 'unknown'}`);
    });
    
    // Also check what the dailyRecord looks like
    console.log('\n=== DAILY RECORD CHECK ===');
    const dailyRecord = await prisma.dailyRecord.findUnique({
        where: {
            stationId_date: { stationId, date: startOfDay }
        },
        include: { meters: true }
    });
    console.log('Daily record found:', dailyRecord ? 'YES' : 'NO');
    if (dailyRecord) {
        console.log('Daily record ID:', dailyRecord.id);
        console.log('Daily record date:', dailyRecord.date.toISOString());
    }
    
    // Check all daily records for station-4
    console.log('\n=== ALL DAILY RECORDS FOR STATION-4 ===');
    const allRecords = await prisma.dailyRecord.findMany({
        where: { stationId },
        orderBy: { date: 'desc' },
        take: 5
    });
    allRecords.forEach(r => console.log(`  ${r.date.toISOString()} | Status: ${r.status}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
