const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
    console.log('=== ตรวจสอบ Transactions เงินเชื่อ ===\n');

    // 1. Get all CREDIT transactions with owner/plate info
    const creditTx = await prisma.transaction.findMany({
        where: { paymentType: 'CREDIT' },
        include: {
            owner: { select: { id: true, name: true, code: true } },
            truck: { select: { licensePlate: true } }
        },
        orderBy: { date: 'desc' }
    });

    console.log('จำนวน CREDIT transactions ทั้งหมด:', creditTx.length);

    // 2. Count transactions with/without owner
    const withOwner = creditTx.filter(t => t.ownerId);
    const withoutOwner = creditTx.filter(t => !t.ownerId);
    console.log('มี owner linked:', withOwner.length);
    console.log('ไม่มี owner linked:', withoutOwner.length);

    // 3. Sample transactions without owner
    if (withoutOwner.length > 0) {
        console.log('\n--- ตัวอย่าง transactions ที่ไม่มี owner (20 แรก) ---');
        withoutOwner.slice(0, 20).forEach(t => {
            console.log('  ', t.licensePlate || 'ไม่มีทะเบียน', '|', t.ownerName || 'ไม่มีชื่อ', '|', Number(t.amount).toFixed(2), 'บาท');
        });
    }

    // 4. Check for duplicate owner names (potential issues)
    const owners = await prisma.owner.findMany({
        select: { id: true, name: true, code: true, groupType: true }
    });

    // Group by normalized name
    const nameMap = new Map();
    owners.forEach(o => {
        const key = o.name.trim().toLowerCase();
        if (!nameMap.has(key)) {
            nameMap.set(key, []);
        }
        nameMap.get(key).push(o);
    });

    // Find duplicates
    const duplicates = [];
    for (const [name, list] of nameMap.entries()) {
        if (list.length > 1) {
            duplicates.push({ name, count: list.length, entries: list });
        }
    }

    console.log('\n=== ชื่อ Owner ซ้ำในระบบ ===');
    console.log('จำนวนชื่อที่ซ้ำ:', duplicates.length);

    if (duplicates.length > 0) {
        duplicates.forEach(d => {
            console.log('\n[' + d.name + '] - พบ ' + d.count + ' ครั้ง');
            d.entries.forEach(e => {
                console.log('  ID:', e.id.slice(0, 8), '| Code:', e.code || '-', '| Group:', e.groupType);
            });
        });
    } else {
        console.log('✅ ไม่พบชื่อซ้ำ!');
    }

    // 5. Check unique ownerName values in transactions that don't have ownerId
    console.log('\n=== ชื่อลูกค้าที่ไม่มี owner link (unique) ===');
    const uniqueNames = new Set();
    withoutOwner.forEach(t => {
        if (t.ownerName) {
            uniqueNames.add(t.ownerName.trim());
        }
    });
    console.log('Unique names without owner:', uniqueNames.size);
    if (uniqueNames.size > 0 && uniqueNames.size <= 30) {
        Array.from(uniqueNames).forEach(name => {
            console.log('  -', name);
        });
    }

    await prisma.$disconnect();
}

checkTransactions().catch(console.error);
