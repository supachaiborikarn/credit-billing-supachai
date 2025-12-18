import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('\n=== TIMEZONE CHECK ===');
  console.log('Server time now:', new Date().toISOString());
  console.log('Server timezone offset (minutes):', new Date().getTimezoneOffset());

  // Check transactions for station-4 today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log('\n=== DATE RANGE ===');
  console.log('Start of today (local):', today.toISOString());
  console.log('End of today (local):', tomorrow.toISOString());

  // Alternative: using date string like the API does
  const dateStr = '2025-12-18';
  const startOfDay = new Date(dateStr + 'T00:00:00');
  const endOfDay = new Date(dateStr + 'T23:59:59.999');
  
  console.log('\n=== API STYLE DATE RANGE ===');
  console.log('startOfDay:', startOfDay.toISOString());
  console.log('endOfDay:', endOfDay.toISOString());

  console.log('\n=== TRANSACTIONS STATION-4 (ALL TIMES) ===');
  const txn4All = await prisma.transaction.findMany({
    where: { stationId: 'station-4' },
    orderBy: { date: 'desc' },
    take: 10,
    select: { id: true, date: true, licensePlate: true, amount: true }
  });
  txn4All.forEach(t => console.log(`  ${t.date.toISOString()} | ${t.licensePlate} | ${t.amount}`));

  console.log('\n=== TRANSACTIONS STATION-4 (FILTERED BY API STYLE DATE) ===');
  const txn4Filtered = await prisma.transaction.findMany({
    where: {
      stationId: 'station-4',
      date: { gte: startOfDay, lte: endOfDay }
    },
    orderBy: { date: 'desc' },
    take: 10,
    select: { id: true, date: true, licensePlate: true, amount: true }
  });
  console.log('Found:', txn4Filtered.length, 'transactions');
  txn4Filtered.forEach(t => console.log(`  ${t.date.toISOString()} | ${t.licensePlate} | ${t.amount}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
