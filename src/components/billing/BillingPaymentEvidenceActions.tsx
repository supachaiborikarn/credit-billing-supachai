'use client';

import * as React from 'react';
import { CheckCircle2, Trash2, XCircle } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Button, ConfirmDialog } from '@/components/ui';
import type { BillingPaymentEvent } from '@/lib/billing/adapter';

export function BillingPaymentEvidenceActions({
    collectionId,
    payment,
    canReview,
    onSuccess,
}: {
    collectionId: string;
    payment: BillingPaymentEvent;
    canReview: boolean;
    onSuccess: () => void | Promise<void>;
}) {
    const { showToast } = useToast();
    const [confirmAction, setConfirmAction] = React.useState<'VERIFIED' | 'REJECTED' | 'DELETE' | null>(null);

    if (!canReview || payment.source !== 'PAYMENT_SLIP' || payment.status !== 'PENDING_REVIEW') return null;

    const submit = async () => {
        if (!confirmAction) return;
        const isDelete = confirmAction === 'DELETE';
        const response = await fetch(`/api/billing-collections/${collectionId}/payment-slips/${payment.id}`, {
            method: isDelete ? 'DELETE' : 'PATCH',
            headers: isDelete ? undefined : { 'Content-Type': 'application/json' },
            body: isDelete ? undefined : JSON.stringify({ status: confirmAction }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message = payload?.error || 'จัดการสลิปไม่สำเร็จ';
            showToast('error', message);
            throw new Error(message);
        }
        showToast('success', isDelete ? 'ลบสลิปรอตรวจแล้ว' : confirmAction === 'VERIFIED' ? 'ยืนยันสลิปแล้ว' : 'ปฏิเสธสลิปแล้ว');
        await onSuccess();
    };

    const title = confirmAction === 'VERIFIED'
        ? 'ยืนยันสลิปนี้?'
        : confirmAction === 'REJECTED'
            ? 'ปฏิเสธสลิปนี้?'
            : 'ลบสลิปรอตรวจนี้?';

    return (
        <>
            <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="success" onClick={() => setConfirmAction('VERIFIED')}>
                    <CheckCircle2 className="h-4 w-4" /> ยืนยัน
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmAction('REJECTED')}>
                    <XCircle className="h-4 w-4" /> ปฏิเสธ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmAction('DELETE')}>
                    <Trash2 className="h-4 w-4" /> ลบ
                </Button>
            </div>
            <ConfirmDialog
                open={confirmAction !== null}
                onOpenChange={(open) => !open && setConfirmAction(null)}
                title={title}
                description={confirmAction === 'VERIFIED'
                    ? 'ยอดสลิปจะถูกนำไปรวม paidAmount ของใบวางบิล'
                    : confirmAction === 'REJECTED'
                        ? 'สลิปจะถูกเก็บเป็นหลักฐานที่ปฏิเสธและไม่เพิ่ม paidAmount'
                        : 'สลิปจะถูกลบออกโดยไม่เพิ่ม paidAmount'}
                tone={confirmAction === 'VERIFIED' ? 'default' : 'danger'}
                confirmLabel={confirmAction === 'VERIFIED' ? 'ยืนยันสลิป' : confirmAction === 'REJECTED' ? 'ปฏิเสธสลิป' : 'ลบสลิป'}
                onConfirm={submit}
            />
        </>
    );
}
