import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAndCreateInvoices() {
    console.log('=== แก้ไขและสร้าง Invoice สำหรับรายการ BOX_TRUCK ช่วง 6-29 มกราคม 2026 ===\n');

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    // Get all BOX_TRUCK transactions without invoice in this period
    const boxTruckTransactions = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            invoiceId: null,
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
        select: {
            id: true,
            ownerName: true,
            ownerId: true,
            amount: true,
            date: true,
            licensePlate: true,
        },
    });

    console.log(`พบ ${boxTruckTransactions.length} รายการ BOX_TRUCK ที่ยังไม่มี invoice\n`);

    // Get all owners
    const allOwners = await prisma.owner.findMany({
        select: { id: true, name: true },
    });

    // Map ownerName to ownerId
    const ownerMap = new Map<string, string>();
    allOwners.forEach(o => {
        ownerMap.set(o.name.toLowerCase().trim(), o.id);
    });

    // Group transactions by ownerName and find matching owners
    const txByOwner: Record<string, { ownerId: string; transactions: typeof boxTruckTransactions }> = {};
    let unmatched = 0;

    for (const tx of boxTruckTransactions) {
        const ownerName = (tx.ownerName || '').toLowerCase().trim();

        if (!ownerName) {
            unmatched++;
            continue;
        }

        const ownerId = ownerMap.get(ownerName);
        if (!ownerId) {
            console.log(`⚠️ ไม่พบเจ้าของ: "${tx.ownerName}"`);
            unmatched++;
            continue;
        }

        if (!txByOwner[ownerId]) {
            txByOwner[ownerId] = { ownerId, transactions: [] };
        }
        txByOwner[ownerId].transactions.push(tx);
    }

    console.log(`\n📊 สรุป:`);
    console.log(`   - จับคู่ได้: ${boxTruckTransactions.length - unmatched} รายการ`);
    console.log(`   - จับคู่ไม่ได้: ${unmatched} รายการ`);
    console.log(`   - จำนวนเจ้าของ: ${Object.keys(txByOwner).length} ราย\n`);

    // Process each owner
    console.log('=== กำลังดำเนินการ ===\n');

    let totalUpdated = 0;
    let totalInvoices = 0;
    let totalAmount = 0;

    for (const ownerId of Object.keys(txByOwner)) {
        const data = txByOwner[ownerId];
        const owner = allOwners.find(o => o.id === ownerId);
        const ownerName = owner?.name || 'ไม่ทราบ';

        // Step 1: Update ownerId for all transactions
        const txIds = data.transactions.map(t => t.id);

        await prisma.transaction.updateMany({
            where: { id: { in: txIds } },
            data: { ownerId: ownerId },
        });

        console.log(`✅ อัพเดท ${txIds.length} รายการ ให้เจ้าของ "${ownerName}"`);
        totalUpdated += txIds.length;

        // Step 2: Create invoice for this owner
        const txTotal = data.transactions.reduce((sum, t) => sum + Number(t.amount), 0);

        // Generate invoice number
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const prefix = `INV-${dateStr}-`;

        const lastInvoice = await prisma.invoice.findFirst({
            where: { invoiceNumber: { startsWith: prefix } },
            orderBy: { invoiceNumber: 'desc' }
        });

        let nextNum = 1;
        if (lastInvoice) {
            const lastNum = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10);
            if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
        const invoiceNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

        // Create invoice
        await prisma.invoice.create({
            data: {
                invoiceNumber,
                owner: { connect: { id: ownerId } },
                totalAmount: txTotal,
                paidAmount: 0,
                status: 'PENDING',
                notes: `รายการรถตู้ทึบ ${txIds.length} รายการ (6-29 ม.ค. 2569)`,
                transactions: { connect: txIds.map(id => ({ id })) }
            },
        });

        console.log(`📄 สร้าง Invoice ${invoiceNumber}: ${ownerName} - ${txIds.length} รายการ, ${txTotal.toFixed(2)} บาท`);
        totalInvoices++;
        totalAmount += txTotal;
    }

    console.log('\n=== สรุปผลการดำเนินการ ===');
    console.log(`✅ อัพเดท ownerId สำเร็จ: ${totalUpdated} รายการ`);
    console.log(`✅ สร้าง Invoice สำเร็จ: ${totalInvoices} ใบ`);
    console.log(`💰 ยอดรวม: ${totalAmount.toFixed(2)} บาท`);

    await prisma.$disconnect();
}

fixAndCreateInvoices().catch(console.error);
