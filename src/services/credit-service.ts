/**
 * Credit Service
 * 
 * จัดการวงเงินเครดิตและใบแจ้งหนี้อัตโนมัติ
 * - ตรวจสอบ credit limit ก่อนบันทึก transaction
 * - อัปเดตยอด currentCredit
 * - สร้าง Invoice อัตโนมัติ
 */

import { prisma } from '@/lib/prisma';

export interface CreditCheckResult {
    allowed: boolean;
    currentCredit: number;
    creditLimit: number;
    remainingCredit: number;
    requestedAmount: number;
    error?: string;
}

/**
 * ตรวจสอบว่าสามารถให้เครดิตได้หรือไม่
 * @param ownerId Owner ID
 * @param amount จำนวนเงินที่ต้องการเครดิต
 */
export async function checkCreditLimit(
    ownerId: string,
    amount: number
): Promise<CreditCheckResult> {
    const owner = await prisma.owner.findUnique({
        where: { id: ownerId },
        select: {
            creditLimit: true,
            currentCredit: true,
            name: true
        }
    });

    if (!owner) {
        return {
            allowed: false,
            currentCredit: 0,
            creditLimit: 0,
            remainingCredit: 0,
            requestedAmount: amount,
            error: 'ไม่พบเจ้าของรถ'
        };
    }

    const creditLimit = Number(owner.creditLimit);
    const currentCredit = Number(owner.currentCredit);
    const remainingCredit = creditLimit - currentCredit;

    if (amount > remainingCredit) {
        return {
            allowed: false,
            currentCredit,
            creditLimit,
            remainingCredit,
            requestedAmount: amount,
            error: `วงเงินเครดิตไม่เพียงพอ (คงเหลือ ${remainingCredit.toLocaleString()} บาท)`
        };
    }

    return {
        allowed: true,
        currentCredit,
        creditLimit,
        remainingCredit,
        requestedAmount: amount
    };
}

/**
 * อัปเดตยอดเครดิตคงค้าง
 * @param ownerId Owner ID
 * @param amount จำนวนเงิน (+ = เพิ่มหนี้, - = ลดหนี้)
 */
export async function updateOwnerCredit(
    ownerId: string,
    amount: number
): Promise<{ success: boolean; newCredit: number; error?: string }> {
    try {
        const owner = await prisma.owner.findUnique({
            where: { id: ownerId },
            select: { currentCredit: true, creditLimit: true }
        });

        if (!owner) {
            return { success: false, newCredit: 0, error: 'ไม่พบเจ้าของรถ' };
        }

        const currentCredit = Number(owner.currentCredit);
        const newCredit = currentCredit + amount;

        // Check if exceeding credit limit (only for increasing credit)
        if (amount > 0 && newCredit > Number(owner.creditLimit)) {
            return {
                success: false,
                newCredit: currentCredit,
                error: 'เกินวงเงินเครดิต'
            };
        }

        await prisma.owner.update({
            where: { id: ownerId },
            data: { currentCredit: Math.max(0, newCredit) }
        });

        return { success: true, newCredit: Math.max(0, newCredit) };
    } catch (error) {
        console.error('[CREDIT] Update error:', error);
        return { success: false, newCredit: 0, error: 'เกิดข้อผิดพลาด' };
    }
}

/**
 * ดึงรายการเจ้าของที่มีเครดิตคงค้าง
 * @param minAmount ยอดขั้นต่ำที่ต้องการดึง (default: 0)
 */
export async function getOwnersWithOutstandingCredit(minAmount: number = 0) {
    return prisma.owner.findMany({
        where: {
            currentCredit: { gt: minAmount },
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            phone: true,
            creditLimit: true,
            currentCredit: true,
            groupType: true,
            _count: { select: { transactions: true } }
        },
        orderBy: { currentCredit: 'desc' }
    });
}

export interface MonthlyInvoiceData {
    ownerId: string;
    ownerName: string;
    transactions: {
        id: string;
        date: Date;
        amount: number;
        licensePlate: string | null;
    }[];
    totalAmount: number;
    statementDate: Date;
    dueDate: Date;
}

/**
 * สร้างข้อมูลใบแจ้งหนี้ประจำเดือน
 * @param ownerId Owner ID
 * @param month เดือน (1-12)
 * @param year ปี
 */
export async function generateMonthlyInvoiceData(
    ownerId: string,
    month: number,
    year: number
): Promise<MonthlyInvoiceData | null> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const owner = await prisma.owner.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true }
    });

    if (!owner) return null;

    const transactions = await prisma.transaction.findMany({
        where: {
            ownerId,
            paymentType: { in: ['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'] },
            date: { gte: startDate, lte: endDate },
            isVoided: false,
            deletedAt: null
        },
        select: {
            id: true,
            date: true,
            amount: true,
            truck: { select: { licensePlate: true } }
        },
        orderBy: { date: 'asc' }
    });

    if (transactions.length === 0) return null;

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const statementDate = new Date(year, month, 1); // 1st of next month
    const dueDate = new Date(year, month, 15); // 15th of next month

    return {
        ownerId: owner.id,
        ownerName: owner.name,
        transactions: transactions.map(t => ({
            id: t.id,
            date: t.date,
            amount: Number(t.amount),
            licensePlate: t.truck?.licensePlate || null
        })),
        totalAmount,
        statementDate,
        dueDate
    };
}

/**
 * สร้าง Invoice จากข้อมูลรายเดือน
 */
export async function createMonthlyInvoice(data: MonthlyInvoiceData): Promise<{
    success: boolean;
    invoiceId?: string;
    invoiceNumber?: string;
    error?: string;
}> {
    try {
        // Check if invoice already exists for this month
        const existingInvoice = await prisma.invoice.findFirst({
            where: {
                ownerId: data.ownerId,
                dueDate: data.dueDate
            }
        });

        if (existingInvoice) {
            return { success: false, error: 'มีใบแจ้งหนี้สำหรับเดือนนี้แล้ว' };
        }

        // Generate invoice number: INV-YYYYMMDD-XXXX
        const dateStr = data.statementDate.toISOString().slice(0, 10).replace(/-/g, '');
        const monthStart = new Date(data.statementDate.getFullYear(), data.statementDate.getMonth(), 1);
        const monthEnd = new Date(data.statementDate.getFullYear(), data.statementDate.getMonth() + 1, 0);

        const countThisMonth = await prisma.invoice.count({
            where: {
                createdAt: { gte: monthStart, lte: monthEnd }
            }
        });

        const invoiceNumber = `INV-${dateStr}-${String(countThisMonth + 1).padStart(4, '0')}`;

        const invoice = await prisma.invoice.create({
            data: {
                ownerId: data.ownerId,
                invoiceNumber,
                totalAmount: data.totalAmount,
                dueDate: data.dueDate,
                status: 'PENDING'
            }
        });

        return { success: true, invoiceId: invoice.id, invoiceNumber };
    } catch (error) {
        console.error('[CREDIT] Create invoice error:', error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการสร้างใบแจ้งหนี้' };
    }
}

/**
 * สร้าง Invoice สำหรับทุกเจ้าของที่มียอดค้าง (Batch)
 * @param month เดือน (1-12)
 * @param year ปี
 */
export async function generateAllMonthlyInvoices(month: number, year: number) {
    const owners = await prisma.owner.findMany({
        where: {
            currentCredit: { gt: 0 },
            deletedAt: null
        },
        select: { id: true }
    });

    const results = {
        total: owners.length,
        created: 0,
        skipped: 0,
        errors: 0
    };

    for (const owner of owners) {
        const invoiceData = await generateMonthlyInvoiceData(owner.id, month, year);

        if (!invoiceData) {
            results.skipped++;
            continue;
        }

        const result = await createMonthlyInvoice(invoiceData);

        if (result.success) {
            results.created++;
        } else if (result.error?.includes('มีใบแจ้งหนี้')) {
            results.skipped++;
        } else {
            results.errors++;
        }
    }

    return results;
}
