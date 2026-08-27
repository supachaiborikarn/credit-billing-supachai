import type { BillingDocumentKind } from './adapter';
import { BILLING_SETTLEMENT_TOLERANCE } from './lifecycle';

export type InvoiceReceiveMethod = 'TRANSFER' | 'CASH' | 'CHECK';

export interface BillingReceivePaymentInput {
    kind: BillingDocumentKind;
    documentId: string;
    amount: number;
    remainingAmount: number;
    paymentMethod?: InvoiceReceiveMethod;
    notes?: string;
    evidenceFile?: File | null;
    transferDate?: string;
    senderName?: string;
    bankName?: string;
}

export interface BillingReceivePaymentResult {
    state: 'CONFIRMED' | 'PENDING_REVIEW';
    message: string;
}

export type BillingPaymentFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class BillingPaymentError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'BillingPaymentError';
        this.status = status;
    }
}

export function validateBillingReceivePayment(input: BillingReceivePaymentInput): string | null {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return 'จำนวนเงินต้องมากกว่า 0';
    }
    if (!Number.isFinite(input.remainingAmount) || input.remainingAmount <= 0) {
        return 'เอกสารนี้ไม่มียอดคงเหลือให้รับชำระ';
    }
    if (input.amount > input.remainingAmount + BILLING_SETTLEMENT_TOLERANCE) {
        return `จำนวนเงินเกินยอดคงเหลือ ${input.remainingAmount.toLocaleString('th-TH')} บาท`;
    }

    if (input.kind === 'BILLING_COLLECTION') {
        if (!input.evidenceFile) return 'กรุณาแนบรูปหลักฐานการชำระเงิน';
        if (!input.evidenceFile.type.startsWith('image/')) return 'หลักฐานการชำระต้องเป็นไฟล์รูปภาพ';
        if (input.evidenceFile.size > 8 * 1024 * 1024) return 'หลักฐานการชำระต้องมีขนาดไม่เกิน 8 MB';
    }

    return null;
}

async function readPayload(response: Response): Promise<Record<string, unknown> | null> {
    return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function uploadPaymentEvidence(
    file: File,
    fetchImpl: BillingPaymentFetch
): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'billing_payment');

    const response = await fetchImpl('/api/upload/transfer-proof', {
        method: 'POST',
        body: formData,
    });
    const payload = await readPayload(response);
    const url = typeof payload?.url === 'string' ? payload.url : null;
    if (!response.ok || !url) {
        throw new BillingPaymentError(
            typeof payload?.error === 'string' ? payload.error : 'อัปโหลดหลักฐานการชำระไม่สำเร็จ',
            response.status
        );
    }
    return url;
}

export async function submitBillingReceivePayment(
    input: BillingReceivePaymentInput,
    fetchImpl: BillingPaymentFetch = fetch
): Promise<BillingReceivePaymentResult> {
    const validationError = validateBillingReceivePayment(input);
    if (validationError) throw new BillingPaymentError(validationError);

    if (input.kind === 'INVOICE') {
        const response = await fetchImpl(`/api/invoices/${input.documentId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: input.amount,
                paymentMethod: input.paymentMethod || 'TRANSFER',
                notes: input.notes?.trim() || null,
            }),
        });
        const payload = await readPayload(response);
        if (!response.ok) {
            throw new BillingPaymentError(
                typeof payload?.error === 'string' ? payload.error : 'บันทึกรับชำระ Invoice ไม่สำเร็จ',
                response.status
            );
        }
        return {
            state: 'CONFIRMED',
            message: 'บันทึกรับชำระเรียบร้อย',
        };
    }

    const evidenceUrl = await uploadPaymentEvidence(input.evidenceFile!, fetchImpl);
    const response = await fetchImpl(`/api/billing-collections/${input.documentId}/payment-slips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slipImageUrl: evidenceUrl,
            amount: input.amount,
            transferDate: input.transferDate || undefined,
            senderName: input.senderName?.trim() || undefined,
            bankName: input.bankName?.trim() || undefined,
            notes: input.notes?.trim() || undefined,
        }),
    });
    const payload = await readPayload(response);
    if (!response.ok) {
        throw new BillingPaymentError(
            typeof payload?.error === 'string' ? payload.error : 'บันทึกหลักฐานการชำระไม่สำเร็จ',
            response.status
        );
    }

    return {
        state: 'PENDING_REVIEW',
        message: 'รับหลักฐานแล้ว รอตรวจสอบสลิปก่อนนับเป็นยอดชำระ',
    };
}
