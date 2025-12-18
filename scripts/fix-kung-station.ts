import { prisma } from '../src/lib/prisma';

async function main() {
    // Check what station d01b9c7b-fcf0-4185-a0b1-a5840391a61c is
    const station = await prisma.station.findUnique({
        where: { id: 'd01b9c7b-fcf0-4185-a0b1-a5840391a61c' }
    });
    
    console.log('Station with UUID d01b9c7b-fcf0-4185-a0b1-a5840391a61c:');
    console.log(station);
    
    // List all stations
    console.log('\n=== Stations ทั้งหมด ===');
    const stations = await prisma.station.findMany();
    stations.forEach(s => console.log(`  ${s.id}: ${s.name}`));
    
    // Check which station กุ้ง should belong to
    // Looking at the pattern, it seems like gas-stations use UUID
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
