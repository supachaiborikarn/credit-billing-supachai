// Fix staff stationId for gas stations
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIXES = [
    // Station 5: ปั๊มแก๊สพงษ์อนันต์
    { username: 'กุ้ง', stationId: 'station-5' },
    { username: 'เล็ก', stationId: 'station-5' },
    // Station 6: ปั๊มแก๊สศุภชัย
    { username: 'เหน่ง', stationId: 'station-6' },
    { username: 'คนอง', stationId: 'station-6' },
];

async function main() {
    console.log('🔧 Fixing gas station staff stationIds...\n');
    
    for (const fix of FIXES) {
        try {
            const result = await prisma.user.updateMany({
                where: { username: fix.username },
                data: { stationId: fix.stationId }
            });
            
            if (result.count > 0) {
                console.log(`✅ Updated: ${fix.username} -> ${fix.stationId}`);
            } else {
                console.log(`⚠️  Not found: ${fix.username}`);
            }
        } catch (error) {
            console.error(`❌ Error updating ${fix.username}:`, error);
        }
    }
    
    console.log('\n✨ Done!');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
