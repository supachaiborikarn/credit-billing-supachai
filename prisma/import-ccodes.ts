const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

interface TruckRow {
    id: string;
    licensePlate: string;
}

async function importCCodes() {
    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const lines = content.split('\n');
    const header = lines[0];
    console.log('Header:', header);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Get all trucks first for fuzzy matching
    const allTrucks: TruckRow[] = await prisma.truck.findMany({
        select: { id: true, licensePlate: true }
    });

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line
        const cols = line.split(',');
        const cCode = cols[4]?.trim(); // รหัส (C-Code)
        const licensePlates = cols[5]?.trim(); // ทะเบียนรถ

        if (!cCode || !licensePlates) continue;

        // ทะเบียนอาจมีหลายอันคั่นด้วย /
        const plates = licensePlates.split('/').map((p: string) => p.trim()).filter((p: string) => p);

        for (const plate of plates) {
            // Normalize plate: remove spaces, dashes and convert to uppercase
            const normalizedPlate = plate.replace(/[-\s]/g, '').toUpperCase();

            try {
                // Try fuzzy match
                const match = allTrucks.find((t: TruckRow) => {
                    const cleanTruck = t.licensePlate.replace(/[-\s]/g, '').toUpperCase();
                    return cleanTruck === normalizedPlate;
                });

                if (match) {
                    await prisma.truck.update({
                        where: { id: match.id },
                        data: { code: cCode }
                    });
                    updated++;
                    console.log(`Updated: ${match.licensePlate} -> ${cCode}`);
                } else {
                    notFound++;
                    if (notFound <= 30) {
                        console.log(`Not found: ${plate} (${cCode})`);
                    }
                }
            } catch (err: unknown) {
                errors++;
                console.error(`Error for ${plate}:`, (err as Error).message);
            }
        }
    }

    console.log('\n=== Summary ===');
    console.log('Updated:', updated);
    console.log('Not found:', notFound);
    console.log('Errors:', errors);

    // Show trucks with code
    const withCode = await prisma.truck.count({ where: { code: { not: null } } });
    console.log('\nTrucks with C-Code now:', withCode);

    await prisma.$disconnect();
}

importCCodes();
