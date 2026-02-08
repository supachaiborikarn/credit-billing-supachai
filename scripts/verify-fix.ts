import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyFix() {
    console.log('=== ตรวจสอบผลลัพธ์หลังแก้ไข ===\n');

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    // Check BOX_TRUCK payment type transactions
    const boxTruckTransactions = await prisma.transaction.findMany({
        where: {
            paymentType: 'BOX_TRUCK',
            date: {
                gte: startDate,
                lte: endDate,
            },
            deletedAt: null,
            isVoided: false,
        },
    });

    const withInvoice = boxTruckTransactions.filter(t => t.invoiceId !== null);
    const withoutInvoice = boxTruckTransactions.filter(t => t.invoiceId === null);

    console.log(`🚚 รายการ BOX_TRUCK ช่วง 6-29 ม.ค.:`);
    console.log(`   ✅ มี invoice: ${withInvoice.length} รายการ`);
    console.log(`   ❌ ไม่มี invoice: ${withoutInvoice.length} รายการ`);

    // Get today's invoices
    const todayInvoices = await prisma.invoice.findMany({
        where: {
            invoiceNumber: { startsWith: 'INV-20260208-' },
        },
        include: {
            owner: { select: { name: true } },
            _count: { select: { transactions: true } },
        },
        orderBy: { invoiceNumber: 'asc' },
    });

    console.log(`\n📄 Invoice ที่สร้างวันนี้ (8 ก.พ. 2569):`);
    todayInvoices.forEach(inv => {
        console.log(`   ${inv.invoiceNumber}: ${inv.owner.name} - ${inv._count.transactions} รายการ, ${Number(inv.totalAmount).toFixed(2)} บาท`);
    });

    // Calculate totals
    const totalAmount = todayInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalTransactions = todayInvoices.reduce((sum, inv) => sum + inv._count.transactions, 0);

    console.log(`\n=== สรุป ===`);
    console.log(`✅ Invoice ที่สร้างวันนี้: ${todayInvoices.length} ใบ`);
    console.log(`✅ รายการที่รวมเข้า invoice: ${totalTransactions} รายการ`);
    console.log(`💰 ยอดรวม: ${totalAmount.toFixed(2)} บาท`);

    await prisma.$disconnect();
}

verifyFix().catch(console.error);
