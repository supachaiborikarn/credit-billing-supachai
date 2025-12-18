import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('\n=== STATIONS ===');
  const stations = await prisma.station.findMany();
  stations.forEach(s => console.log(`  ${s.id}: ${s.name} (${s.type})`));

  console.log('\n=== USERS ===');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, stationId: true }
  });
  users.forEach(u => console.log(`  ${u.name} (${u.role}) - station: ${u.stationId || 'none'}`));

  console.log('\n=== RECENT TRANSACTIONS STATION-3 (พงษ์อนันต์) ===');
  const txn3 = await prisma.transaction.findMany({
    where: { stationId: 'station-3' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, date: true, licensePlate: true, amount: true, paymentType: true, recordedById: true }
  });
  txn3.forEach(t => console.log(`  ${t.date.toISOString().split('T')[0]} | ${t.licensePlate} | ${t.amount} | ${t.paymentType}`));

  console.log('\n=== RECENT TRANSACTIONS STATION-4 (ศุภชัย) ===');
  const txn4 = await prisma.transaction.findMany({
    where: { stationId: 'station-4' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, date: true, licensePlate: true, amount: true, paymentType: true, recordedById: true }
  });
  txn4.forEach(t => console.log(`  ${t.date.toISOString().split('T')[0]} | ${t.licensePlate} | ${t.amount} | ${t.paymentType}`));

  console.log('\n=== ACTIVE SESSIONS ===');
  const sessions = await prisma.session.findMany({
    where: { expiresAt: { gte: new Date() } },
    include: { user: { select: { name: true, role: true } } }
  });
  sessions.forEach(s => console.log(`  ${s.user.name} (${s.user.role}) - expires: ${s.expiresAt.toISOString()}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
