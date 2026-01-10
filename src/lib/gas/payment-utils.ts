/**
 * Gas Station Payment and Reconciliation Utilities
 * 
 * Functions for payment processing and shift reconciliation
 */

export const PAYMENT_TYPES = ['CASH', 'CREDIT', 'CARD', 'TRANSFER'] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export interface PaymentTypeInfo {
    type: PaymentType;
    name: string;
    icon: string;
    color: string;
}

export const PAYMENT_TYPE_INFO: Record<PaymentType, PaymentTypeInfo> = {
    CASH: {
        type: 'CASH',
        name: 'เงินสด',
        icon: '💵',
        color: 'text-green-400'
    },
    CREDIT: {
        type: 'CREDIT',
        name: 'เงินเชื่อ',
        icon: '📝',
        color: 'text-purple-400'
    },
    CARD: {
        type: 'CARD',
        name: 'บัตรเครดิต',
        icon: '💳',
        color: 'text-blue-400'
    },
    TRANSFER: {
        type: 'TRANSFER',
        name: 'โอนเงิน',
        icon: '📱',
        color: 'text-cyan-400'
    }
};

export interface ReconciliationData {
    cashReceived: number;
    creditReceived: number;
    cardReceived: number;
    transferReceived: number;
    expectedFuelAmount: number;
    expectedOtherAmount: number;
}

export interface ReconciliationResult {
    totalExpected: number;
    totalReceived: number;
    variance: number;
    varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
    variancePercentage: number;
}

/**
 * Calculate reconciliation totals
 */
export function calculateReconciliation(data: ReconciliationData): ReconciliationResult {
    const totalExpected = data.expectedFuelAmount + data.expectedOtherAmount;
    const totalReceived = data.cashReceived + data.creditReceived + data.cardReceived + data.transferReceived;
    const variance = totalReceived - totalExpected;
    const variancePercentage = totalExpected > 0
        ? (variance / totalExpected) * 100
        : 0;

    let varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
    if (variance > 0) {
        varianceStatus = 'OVER';
    } else if (variance < 0) {
        varianceStatus = 'SHORT';
    } else {
        varianceStatus = 'BALANCED';
    }

    return {
        totalExpected,
        totalReceived,
        variance,
        varianceStatus,
        variancePercentage
    };
}

/**
 * Validate reconciliation data
 */
export function validateReconciliation(data: Partial<ReconciliationData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.cashReceived === undefined || data.cashReceived < 0) {
        errors.push('ต้องกรอกยอดเงินสด');
    }

    if (data.creditReceived === undefined || data.creditReceived < 0) {
        errors.push('ต้องกรอกยอดเงินเชื่อ');
    }

    if (data.cardReceived === undefined || data.cardReceived < 0) {
        errors.push('ต้องกรอกยอดบัตรเครดิต');
    }

    if (data.transferReceived === undefined || data.transferReceived < 0) {
        errors.push('ต้องกรอกยอดโอนเงิน');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get variance status color class
 */
export function getVarianceColorClass(status: 'OVER' | 'SHORT' | 'BALANCED'): string {
    switch (status) {
        case 'OVER': return 'text-green-400';
        case 'SHORT': return 'text-red-400';
        case 'BALANCED': return 'text-gray-400';
    }
}

/**
 * Get variance status icon
 */
export function getVarianceIcon(status: 'OVER' | 'SHORT' | 'BALANCED'): string {
    switch (status) {
        case 'OVER': return '💰';
        case 'SHORT': return '⚠️';
        case 'BALANCED': return '✓';
    }
}

/**
 * Get variance status text
 */
export function getVarianceText(status: 'OVER' | 'SHORT' | 'BALANCED'): string {
    switch (status) {
        case 'OVER': return 'เงินเกิน';
        case 'SHORT': return 'เงินขาด';
        case 'BALANCED': return 'ยอดตรง';
    }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Parse currency string to number
 */
export function parseCurrency(str: string): number {
    const cleaned = str.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
}
