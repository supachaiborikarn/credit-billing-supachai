import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBoxTruckInvoices() {
    console.log('=== สร้าง Invoice สำหรับรายการ BOX_TRUCK ช่วง 6-29 มกราคม 2026 ===\n');

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    console.log(`📅 ช่วงเวลา: ${startDate.toISOString()} ถึง ${endDate.toISOString()}\n`);

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
        include: {
            owner: { select: { id: true, name: true, code: true } },
        },
        orderBy: { date: 'asc' },
    });

    console.log(`🚚 พบ ${boxTruckTransactions.length} รายการ BOX_TRUCK ที่ยังไม่มี invoice\n`);

    if (boxTruckTransactions.length === 0) {
        console.log('ไม่มีรายการที่ต้องสร้าง invoice');
        await prisma.$disconnect();
        return;
    }

    // Group by owner
    const byOwner = boxTruckTransactions.reduce((acc, t) => {
        const ownerId = t.ownerId;
        if (!ownerId) return acc;
        if (!acc[ownerId]) {
            acc[ownerId] = {
                ownerName: t.owner?.name || 'ไม่ทราบ',
                transactions: [],
                totalAmount: 0,
            };
        }
        acc[ownerId].transactions.push(t);
        acc[ownerId].totalAmount += Number(t.amount);
        return acc;
    }, {} as Record<string, { ownerName: string; transactions: typeof boxTruckTransactions; totalAmount: number }>);

    const ownerIds = Object.keys(byOwner);
    console.log(`👥 แบ่งเป็น ${ownerIds.length} เจ้าของ\n`);

    // Preview mode - show what would be created
    console.log('=== Preview รายการที่จะสร้าง Invoice ===');
    ownerIds.forEach(ownerId => {
        const data = byOwner[ownerId];
        console.log(`${data.ownerName}: ${data.transactions.length} รายการ, ${data.totalAmount.toFixed(2)} บาท`);
    });

    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const answer = await new Promise<string>(resolve => {
        rl.question('\n❓ ต้องการสร้าง invoice ทั้งหมดหรือไม่? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('ยกเลิกการสร้าง invoice');
        await prisma.$disconnect();
        return;
    }

    // Create invoices
    console.log('\n🔄 กำลังสร้าง invoice...\n');

    let createdCount = 0;
    let totalTransactionsAdded = 0;
    const errors: string[] = [];

    for (const ownerId of ownerIds) {
        const data = byOwner[ownerId];

        try {
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
            const invoice = await prisma.invoice.create({
                data: {
                    invoiceNumber,
                    owner: { connect: { id: ownerId } },
                    totalAmount: data.totalAmount,
                    paidAmount: 0,
                    status: 'PENDING',
                    notes: `รายการรถตู้ทึบ ${data.transactions.length} รายการ (6-29 ม.ค. 2026)`,
                    transactions: { connect: data.transactions.map(t => ({ id: t.id })) }
                },
            });

            createdCount++;
            totalTransactionsAdded += data.transactions.length;
            console.log(`✅ ${invoiceNumber}: ${data.ownerName} - ${data.transactions.length} รายการ, ${data.totalAmount.toFixed(2)} บาท`);
        } catch (error: any) {
            errors.push(`${data.ownerName}: ${error.message}`);
            console.error(`❌ Error for ${data.ownerName}:`, error.message);
        }
    }

    console.log('\n=== สรุป ===');
    console.log(`✅ สร้าง invoice สำเร็จ: ${createdCount} ใบ`);
    console.log(`📋 รายการที่เพิ่มเข้า invoice: ${totalTransactionsAdded} รายการ`);
    if (errors.length > 0) {
        console.log(`❌ Error: ${errors.length} รายการ`);
    }

    await prisma.$disconnect();
}

createBoxTruckInvoices().catch(console.error);
