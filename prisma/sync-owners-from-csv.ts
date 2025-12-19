import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface CsvRow {
    vender: string;
    name: string;
    code: string;
    phone: string;
}

async function syncOwnersFromCsv() {
    console.log('===== SYNC OWNERS FROM CSV =====\n');

    // Read CSV
    const csvPath = path.join(__dirname, '..', 'คลีน_6869.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').slice(1); // Skip header

    // Parse unique owners from CSV
    const ownerMap = new Map<string, CsvRow>();

    for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split(',');
        const vender = parts[1]?.trim() || '';
        const name = parts[2]?.trim() || '';
        const code = parts[4]?.trim() || '';
        const phone = parts[6]?.trim() || '';

        if (!name) continue;

        // Only keep first occurrence (unique by name)
        if (!ownerMap.has(name)) {
            ownerMap.set(name, { vender, name, code, phone });
        }
    }

    console.log('Unique owners in CSV:', ownerMap.size);

    // Step 1: Soft delete all current owners
    const deleted = await prisma.owner.updateMany({
        where: { deletedAt: null },
        data: { deletedAt: new Date() }
    });
    console.log('Soft deleted existing owners:', deleted.count);

    // Step 2: Create/restore owners from CSV
    let created = 0;
    let restored = 0;

    for (const [name, data] of ownerMap) {
        // Try to find existing owner (even deleted ones)
        const existing = await prisma.owner.findFirst({
            where: { name }
        });

        if (existing) {
            // Restore and update
            await prisma.owner.update({
                where: { id: existing.id },
                data: {
                    deletedAt: null,
                    venderCode: data.vender || existing.venderCode,
                    code: data.code || existing.code,
                    phone: data.phone || existing.phone,
                    groupType: 'SUGAR_FACTORY',
                }
            });
            restored++;
        } else {
            // Create new
            await prisma.owner.create({
                data: {
                    name: data.name,
                    venderCode: data.vender,
                    code: data.code,
                    phone: data.phone,
                    groupType: 'SUGAR_FACTORY',
                }
            });
            created++;
        }
    }

    console.log('Restored from soft-delete:', restored);
    console.log('Created new:', created);

    // Step 3: Also restore วีระวณิชย์ and other common names not in CSV
    const additionalNames = [
        'บจก.กำแพงเพชรวีระวณิชย์',
        'บจก.กำแพงเพชรเพชรซอนด้า',
        'บจก.กำแพงทองขนส่ง',
        'บ.ฮอนด้ากำแพงเพชร',
    ];

    for (const name of additionalNames) {
        const existing = await prisma.owner.findFirst({
            where: { name, deletedAt: { not: null } }
        });

        if (existing) {
            await prisma.owner.update({
                where: { id: existing.id },
                data: { deletedAt: null }
            });
            console.log('Restored additional:', name);
        }
    }

    // Final count
    const finalCount = await prisma.owner.count({ where: { deletedAt: null } });
    console.log('\n===== SUMMARY =====');
    console.log('Total active owners:', finalCount);

    await prisma.$disconnect();
}

syncOwnersFromCsv();
