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

export {
    generateMonthlyInvoiceData,
    createMonthlyInvoice,
    generateAllMonthlyInvoices,
} from '@/services/monthly-invoice-service';
