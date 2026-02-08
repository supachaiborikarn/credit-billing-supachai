import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPendingOwners() {
    console.log('=== ตรวจสอบ Pending Owners API Logic ===\n');

    // Simulate the pending API logic
    const ownersWithPendingCredit = await prisma.owner.findMany({
        where: {
            transactions: {
                some: {
                    paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                    invoiceId: null,
                }
            }
        },
        include: {
            transactions: {
                where: {
                    paymentType: { in: ['CREDIT', 'BOX_TRUCK'] },
                    invoiceId: null,
                },
                select: {
                    id: true,
                    amount: true,
                    date: true,
                    paymentType: true,
                    isVoided: true,
                    deletedAt: true,
                }
            }
        }
    });

    console.log(`เจ้าของที่มีรายการรอวางบิล: ${ownersWithPendingCredit.length} ราย\n`);

    // Date range: January 6-29, 2026 (Bangkok time)
    const startDate = new Date('2026-01-06T00:00:00+07:00');
    const endDate = new Date('2026-01-29T23:59:59.999+07:00');

    let totalTransactions = 0;
    let janTransactions = 0;
    let voidedCount = 0;
    let deletedCount = 0;

    ownersWithPendingCredit.forEach(owner => {
        const allTx = owner.transactions;
        const janTx = allTx.filter(t => t.date >= startDate && t.date <= endDate);
        const voided = allTx.filter(t => t.isVoided);
        const deleted = allTx.filter(t => t.deletedAt !== null);

        totalTransactions += allTx.length;
        janTransactions += janTx.length;
        voidedCount += voided.length;
        deletedCount += deleted.length;

        if (janTx.length > 0) {
            const janTotal = janTx.reduce((sum, t) => sum + Number(t.amount), 0);
            console.log(`${owner.name}: ${janTx.length} รายการ (6-29 ม.ค.), ${janTotal.toFixed(2)} บาท`);
        }
    });

    console.log(`\n=== สรุป ===`);
    console.log(`รายการรอวางบิลทั้งหมด: ${totalTransactions} รายการ`);
    console.log(`รายการช่วง 6-29 ม.ค.: ${janTransactions} รายการ`);
    console.log(`รายการที่ถูก void: ${voidedCount} รายการ`);
    console.log(`รายการที่ถูก delete: ${deletedCount} รายการ`);

    // Check specific owners like those with large pending amounts
    console.log('\n=== ตรวจสอบเจ้าของที่มียอดสูง ===');
    const topOwners = ownersWithPendingCredit
        .map(o => ({
            name: o.name,
            transactionCount: o.transactions.length,
            totalAmount: o.transactions.reduce((sum, t) => sum + Number(t.amount), 0),
            groupType: 'check-db'
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

    topOwners.forEach(o => {
        console.log(`${o.name}: ${o.transactionCount} รายการ, ${o.totalAmount.toFixed(2)} บาท`);
    });

    await prisma.$disconnect();
}

checkPendingOwners().catch(console.error);
