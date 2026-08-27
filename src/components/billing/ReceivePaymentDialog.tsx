'use client';

import * as React from 'react';
import { Banknote, Upload } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Button, ConfirmDialog, Dialog, Input, Notice } from '@/components/ui';
import {
    submitBillingReceivePayment,
    validateBillingReceivePayment,
    type InvoiceReceiveMethod,
} from '@/lib/billing/payment';
import type { BillingWorkspaceItem } from '@/types/billing';

interface ReceivePaymentDialogProps {
    document: BillingWorkspaceItem;
    canReceivePayment: boolean;
    onSuccess: () => void | Promise<void>;
}

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

export function ReceivePaymentDialog({
    document,
    canReceivePayment,
    onSuccess,
}: ReceivePaymentDialogProps) {
    const { showToast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [amount, setAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState<InvoiceReceiveMethod>('TRANSFER');
    const [notes, setNotes] = React.useState('');
    const [evidenceFile, setEvidenceFile] = React.useState<File | null>(null);
    const [transferDate, setTransferDate] = React.useState('');
    const [senderName, setSenderName] = React.useState('');
    const [bankName, setBankName] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    const isCollection = document.kind === 'BILLING_COLLECTION';
    const blockedReason = !canReceivePayment
        ? 'เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกรับชำระได้'
        : document.dataQualityFlags.length > 0
            ? 'เอกสารมีข้อมูลผิดปกติ กรุณาตรวจข้อมูลก่อนรับชำระ'
            : isCollection && document.pendingPaymentReviews > 0
                ? 'มีสลิปรอตรวจอยู่แล้ว กรุณาตรวจสลิปเดิมก่อนรับหลักฐานเพิ่ม'
                : document.stage === 'CLOSED' || document.remainingAmount <= 0
                    ? 'เอกสารนี้ปิดยอดแล้ว'
                    : null;

    const resetForm = React.useCallback(() => {
        setAmount(document.remainingAmount > 0 ? String(document.remainingAmount) : '');
        setPaymentMethod('TRANSFER');
        setNotes('');
        setEvidenceFile(null);
        setTransferDate('');
        setSenderName('');
        setBankName('');
        setError(null);
    }, [document.remainingAmount]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) resetForm();
    };

    const paymentInput = React.useMemo(() => ({
        kind: document.kind === 'BILLING_COLLECTION' ? 'BILLING_COLLECTION' as const : 'INVOICE' as const,
        documentId: document.documentId || '',
        amount: Number.parseFloat(amount),
        remainingAmount: document.remainingAmount,
        paymentMethod,
        notes,
        evidenceFile,
        transferDate,
        senderName,
        bankName,
    }), [
        amount,
        bankName,
        document.documentId,
        document.kind,
        document.remainingAmount,
        evidenceFile,
        notes,
        paymentMethod,
        senderName,
        transferDate,
    ]);

    const requestConfirmation = () => {
        setError(null);
        const validationError = validateBillingReceivePayment(paymentInput);
        if (validationError) {
            setError(validationError);
            return;
        }
        setConfirmOpen(true);
    };

    const submit = async () => {
        try {
            const result = await submitBillingReceivePayment(paymentInput);
            showToast(result.state === 'CONFIRMED' ? 'success' : 'info', result.message);
            setOpen(false);
            await onSuccess();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'บันทึกรับชำระไม่สำเร็จ';
            setError(message);
            showToast('error', message);
        }
    };

    if (blockedReason) {
        return (
            <Notice tone={document.stage === 'CLOSED' ? 'success' : 'warning'} title="รับชำระจากหน้านี้ไม่ได้">
                {blockedReason}
            </Notice>
        );
    }

    return (
        <>
            <Button onClick={() => handleOpenChange(true)}>
                <Banknote className="h-4 w-4" />
                รับชำระ
            </Button>

            <Dialog
                open={open}
                onOpenChange={handleOpenChange}
                title={isCollection ? 'รับหลักฐานการชำระ' : 'บันทึกรับชำระ Invoice'}
                description={`ยอดคงเหลือ ฿${moneyFormatter.format(document.remainingAmount)}`}
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                        <Button onClick={requestConfirmation}>ตรวจและยืนยัน</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {error && <Notice tone="danger">{error}</Notice>}

                    <Input
                        label="จำนวนเงิน"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        requiredMark
                        helperText={`รับเต็มยอด = ฿${moneyFormatter.format(document.remainingAmount)} หรือแก้เป็นยอดบางส่วนได้`}
                    />

                    {isCollection ? (
                        <>
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold">รูปหลักฐานการชำระ *</label>
                                <label className="flex min-h-[var(--ui-touch-target)] cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border-strong)] bg-[var(--ui-surface-subtle)] px-3 py-3 text-sm font-semibold">
                                    <Upload className="h-4 w-4" aria-hidden="true" />
                                    {evidenceFile ? evidenceFile.name : 'เลือกรูปสลิป'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                                    />
                                </label>
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">รูปภาพไม่เกิน 8 MB</div>
                            </div>

                            <Input
                                label="วันที่โอน (ถ้ามี)"
                                type="date"
                                value={transferDate}
                                onChange={(event) => setTransferDate(event.target.value)}
                            />
                            <Input
                                label="ชื่อผู้โอน (ถ้ามี)"
                                value={senderName}
                                onChange={(event) => setSenderName(event.target.value)}
                            />
                            <Input
                                label="ธนาคาร (ถ้ามี)"
                                value={bankName}
                                onChange={(event) => setBankName(event.target.value)}
                            />
                            <Notice tone="info" title="ยอดยังไม่ถูกนับทันที">
                                หลังบันทึก สลิปจะอยู่สถานะรอตรวจ และ paidAmount จะเพิ่มเมื่อผู้ดูแลยืนยันสลิปเท่านั้น
                            </Notice>
                        </>
                    ) : (
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold">วิธีชำระ</label>
                            <select
                                value={paymentMethod}
                                onChange={(event) => setPaymentMethod(event.target.value as InvoiceReceiveMethod)}
                                className="h-[var(--ui-control-md)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm"
                            >
                                <option value="TRANSFER">โอนเงิน</option>
                                <option value="CASH">เงินสด</option>
                                <option value="CHECK">เช็ค</option>
                            </select>
                        </div>
                    )}

                    <Input
                        label="หมายเหตุ (ถ้ามี)"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                    />
                </div>
            </Dialog>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="ยืนยันการรับชำระ"
                description={isCollection
                    ? 'ระบบจะบันทึกหลักฐานเป็น “รอตรวจ” และยังไม่เพิ่มยอดชำระจนกว่าสลิปจะผ่านการยืนยัน'
                    : 'ระบบจะสร้าง Payment และอัปเดตยอด Invoice ใน transaction เดียว'}
                confirmLabel={isCollection ? 'บันทึกหลักฐาน' : 'ยืนยันรับเงิน'}
                onConfirm={submit}
            >
                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-4 text-center">
                    <div className="text-xs font-semibold text-[var(--ui-text-muted)]">จำนวนเงิน</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">฿{moneyFormatter.format(Number.parseFloat(amount) || 0)}</div>
                </div>
            </ConfirmDialog>
        </>
    );
}
