/**
 * Owner Groups - กลุ่มเจ้าของรถ
 * Synced with Prisma enum OwnerGroup
 */

export const OwnerGroup = {
    SUGAR_FACTORY: 'SUGAR_FACTORY',
    GENERAL_CREDIT: 'GENERAL_CREDIT',
    BOX_TRUCK: 'BOX_TRUCK',
    OIL_TRUCK: 'OIL_TRUCK',
} as const;

export type OwnerGroupValue = typeof OwnerGroup[keyof typeof OwnerGroup];

/**
 * Thai labels for owner groups
 */
export const OwnerGroupLabels: Record<OwnerGroupValue, string> = {
    SUGAR_FACTORY: 'โรงงานน้ำตาล',
    GENERAL_CREDIT: 'เงินเชื่อทั่วไป',
    BOX_TRUCK: 'รถตู้',
    OIL_TRUCK: 'รถน้ำมัน',
};

/**
 * Owner groups that belong to credit billing
 */
export const CREDIT_OWNER_GROUPS: OwnerGroupValue[] = [
    OwnerGroup.SUGAR_FACTORY,
    OwnerGroup.GENERAL_CREDIT,
];
