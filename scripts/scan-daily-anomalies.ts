/**
 * Script: Scan historical daily anomalies for Full stations
 * 
 * Run: npx tsx scripts/scan-daily-anomalies.ts
 */

import { PrismaClient } from '@prisma/client';
import { scanHistoricalAnomalies } from '../src/services/daily-anomaly-detection';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Scanning historical daily anomalies...\n');

    // Get all FULL stations
    const fullStations = await prisma.station.findMany({
        where: { type: 'FULL' },
        select: { id: true, name: true }
    });

    console.log(`Found ${fullStations.length} FULL station(s):\n`);

    for (const station of fullStations) {
        console.log(`\n📍 ${station.name} (${station.id})`);
        console.log('─'.repeat(40));

        const result = await scanHistoricalAnomalies(station.id, 30);
        console.log(`   Scanned: ${result.scanned} days`);
        console.log(`   Anomalies found: ${result.found}`);
    }

    console.log('\n✅ Scan complete!');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
