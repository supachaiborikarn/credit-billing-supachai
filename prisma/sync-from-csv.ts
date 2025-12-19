import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
    vender: string;
    name: string;
    type: string;
    code: string;
    licensePlate: string;
    phone: string;
}

function parseCSV(content: string): CSVRow[] {
    const lines = content.split('\n');
    const rows: CSVRow[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        if (cols.length < 6) continue;

        const code = cols[4]?.trim();
        const name = cols[2]?.trim();
        const licensePlate = cols[5]?.trim();

        if (!code || !name || !licensePlate) continue;

        rows.push({
            vender: cols[1]?.trim() || '',
            name,
            type: cols[3]?.trim() || '',
            code,
            licensePlate,
            phone: cols[6]?.trim() || '',
        });
    }

    return rows;
}

async function main() {
    console.log('🔄 กำลัง Sync ข้อมูลจาก คลีน_6869.csv...\n');

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);

    console.log(`📋 พบข้อมูล ${rows.length} รายการในไฟล์ CSV\n`);

    let ownersUpdated = 0;
    let ownersCreated = 0;
    let trucksUpdated = 0;
    let trucksCreated = 0;
    let errors: string[] = [];

    // Group by owner code to handle duplicates
    const ownerMap = new Map<string, { name: string; vender: string; phone: string; trucks: string[] }>();

    for (const row of rows) {
        if (!ownerMap.has(row.code)) {
            ownerMap.set(row.code, {
                name: row.name,
                vender: row.vender,
                phone: row.phone,
                trucks: [row.licensePlate],
            });
        } else {
            ownerMap.get(row.code)!.trucks.push(row.licensePlate);
        }
    }

    console.log(`👤 พบ ${ownerMap.size} เจ้าของ (Owner)\n`);

    // Process each owner
    for (const [code, data] of ownerMap) {
        try {
            // Find existing owner by code
            let owner = await prisma.owner.findFirst({
                where: { code }
            });

            if (owner) {
                // Update name if different
                if (owner.name !== data.name) {
                    console.log(`🔄 อัปเดต ${code}: "${owner.name}" → "${data.name}"`);
                    owner = await prisma.owner.update({
                        where: { id: owner.id },
                        data: {
                            name: data.name,
                            venderCode: data.vender || owner.venderCode,
                            phone: data.phone || owner.phone,
                        }
                    });
                    ownersUpdated++;
                }
            } else {
                // Create new owner
                console.log(`➕ สร้างใหม่ ${code}: "${data.name}"`);
                owner = await prisma.owner.create({
                    data: {
                        name: data.name,
                        code,
                        venderCode: data.vender || null,
                        phone: data.phone || null,
                        groupType: 'SUGAR_FACTORY',
                    }
                });
                ownersCreated++;
            }

            // Process trucks for this owner
            for (const plateStr of data.trucks) {
                // Handle paired trucks (e.g., "กพ82-6905/กพ82-6906")
                const plates = plateStr.split('/').map(p => p.trim()).filter(p => p);

                for (const plate of plates) {
                    if (!plate) continue;

                    // Find existing truck
                    let truck = await prisma.truck.findFirst({
                        where: { licensePlate: plate }
                    });

                    if (truck) {
                        // Update owner if different
                        if (truck.ownerId !== owner.id) {
                            await prisma.truck.update({
                                where: { id: truck.id },
                                data: { ownerId: owner.id }
                            });
                            trucksUpdated++;
                        }
                    } else {
                        // Create new truck
                        await prisma.truck.create({
                            data: {
                                licensePlate: plate,
                                ownerId: owner.id,
                            }
                        });
                        trucksCreated++;
                    }
                }
            }
        } catch (error: any) {
            errors.push(`${code} - ${data.name}: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 สรุปผล:');
    console.log(`  👤 Owner อัปเดต: ${ownersUpdated}`);
    console.log(`  👤 Owner สร้างใหม่: ${ownersCreated}`);
    console.log(`  🚗 Truck อัปเดต: ${trucksUpdated}`);
    console.log(`  🚗 Truck สร้างใหม่: ${trucksCreated}`);

    if (errors.length > 0) {
        console.log(`\n❌ Errors (${errors.length}):`);
        errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n✅ เสร็จสิ้น!');
}

main()
    .catch((e) => {
        console.error('❌ Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
