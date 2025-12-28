/**
 * Payment Types - ประเภทการชำระเงิน
 * Synced with Prisma enum PaymentType
 */

export const PaymentType = {
    CASH: 'CASH',
    CREDIT: 'CREDIT',
    TRANSFER: 'TRANSFER',
    BOX_TRUCK: 'BOX_TRUCK',
    OIL_TRUCK_SUPACHAI: 'OIL_TRUCK_SUPACHAI',
    CREDIT_CARD: 'CREDIT_CARD',
} as const;

export type PaymentTypeValue = typeof PaymentType[keyof typeof PaymentType];

/**
 * Thai labels for payment types - ชื่อภาษาไทย
 */
export const PaymentTypeLabels: Record<PaymentTypeValue, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    BOX_TRUCK: 'รถตู้',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
    CREDIT_CARD: 'บัตรเครดิต',
};

/**
 * Payment types that require owner/truck info
 */
export const CREDIT_PAYMENT_TYPES: PaymentTypeValue[] = [
    PaymentType.CREDIT,
    PaymentType.BOX_TRUCK,
    PaymentType.OIL_TRUCK_SUPACHAI,
];

/**
 * Check if payment type requires credit info (owner, truck, etc.)
 */
export function isCreditPayment(type: PaymentTypeValue): boolean {
    return CREDIT_PAYMENT_TYPES.includes(type);
}
