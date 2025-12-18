import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('=== ตรวจสอบ User กุ้ง ===');
    
    const users = await prisma.user.findMany({
        where: {
            name: { contains: 'กุ้ง', mode: 'insensitive' }
        },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            stationId: true,
        }
    });
    
    console.log('พบ users:', users.length);
    users.forEach(u => {
        console.log(`  - ${u.name} (${u.username})`);
        console.log(`    Role: ${u.role}`);
        console.log(`    Station ID: ${u.stationId || 'ไม่มี'}`);
    });
    
    // Show all staff with their stations
    console.log('\n=== Staff ทั้งหมดและ Station ===');
    const allStaff = await prisma.user.findMany({
        where: { role: 'STAFF' },
        select: { name: true, stationId: true }
    });
    allStaff.forEach(s => console.log(`  ${s.name}: ${s.stationId || 'ไม่มี station'}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
