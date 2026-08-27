import type { NormalizedBillingDocument } from './adapter';

export type BillingExceptionType =
    | 'MISSING_SOURCE'
    | 'PAYMENT_MISMATCH'
    | 'INVALID_FINANCIAL_STATE'
    | 'OVERDUE'
    | 'PENDING_PAYMENT_REVIEW'
    | 'REJECTED_PAYMENT_EVIDENCE'
    | 'DUPLICATE_PENDING_EVIDENCE';

export type BillingExceptionSeverity = 'warning' | 'critical';

export interface BillingException {
    type: BillingExceptionType;
    severity: BillingExceptionSeverity;
    label: string;
    detail: string;
}

export function getBillingExceptions(document: NormalizedBillingDocument): BillingException[] {
    const exceptions: BillingException[] = [];

    if (document.dataQualityFlags.includes('MISSING_SOURCE_ITEMS')) {
        exceptions.push({
            type: 'MISSING_SOURCE',
            severity: 'critical',
            label: 'ไม่พบรายการต้นทาง',
            detail: 'เอกสารมียอดเงินแต่ไม่มี source items ที่เชื่อมกลับไปตรวจสอบได้',
        });
    }

    if (document.dataQualityFlags.includes('PAID_AMOUNT_MISMATCH')) {
        exceptions.push({
            type: 'PAYMENT_MISMATCH',
            severity: 'critical',
            label: 'ยอดรับเงินไม่ตรงหลักฐาน',
            detail: 'paidAmount ไม่ตรงกับ Payment หรือสลิปที่ยืนยันแล้ว',
        });
    }

    const invalidFlags = document.dataQualityFlags.filter((flag) =>
        flag === 'STATUS_AMOUNT_MISMATCH' || flag === 'OVERPAID_AMOUNT'
    );
    if (invalidFlags.length > 0) {
        exceptions.push({
            type: 'INVALID_FINANCIAL_STATE',
            severity: 'critical',
            label: 'สถานะการเงินผิดปกติ',
            detail: invalidFlags.join(', '),
        });
    }

    if (document.overdue) {
        exceptions.push({
            type: 'OVERDUE',
            severity: 'warning',
            label: 'เกินกำหนดชำระ',
            detail: 'เอกสารยังมียอดคงเหลือและเลยวันครบกำหนดแล้ว',
        });
    }

    if (document.attention.pendingPaymentReviews > 0) {
        exceptions.push({
            type: 'PENDING_PAYMENT_REVIEW',
            severity: document.attention.pendingPaymentReviews > 1 ? 'critical' : 'warning',
            label: 'มีหลักฐานรอตรวจ',
            detail: `${document.attention.pendingPaymentReviews} สลิปรอการตรวจสอบ`,
        });
    }

    if (document.attention.pendingPaymentReviews > 1) {
        exceptions.push({
            type: 'DUPLICATE_PENDING_EVIDENCE',
            severity: 'critical',
            label: 'มีสลิปรอตรวจซ้ำ',
            detail: 'พบสลิป PENDING มากกว่า 1 รายการ ควรตรวจยอดก่อนยืนยันสลิปใด ๆ',
        });
    }

    if (document.attention.rejectedPaymentEvidence > 0) {
        exceptions.push({
            type: 'REJECTED_PAYMENT_EVIDENCE',
            severity: 'warning',
            label: 'มีหลักฐานถูกปฏิเสธ',
            detail: `${document.attention.rejectedPaymentEvidence} สลิปถูกปฏิเสธ`,
        });
    }

    return exceptions;
}

export function hasCriticalBillingException(exceptions: BillingException[]): boolean {
    return exceptions.some((exception) => exception.severity === 'critical');
}
