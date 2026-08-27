'use client';

import * as React from 'react';
import {
    Banknote,
    Building2,
    CreditCard,
    Landmark,
    ReceiptText,
    Truck,
    Upload,
} from 'lucide-react';
import { Button, Input, Notice, Section } from '@/components/ui';
import type {
    SaleFlowCapabilities,
    SaleFlowEvidence,
    SaleFlowPaymentSelection,
    SaleFlowPaymentType,
} from '@/lib/sales/sale-flow';
import { getSaleFlowLegacyRouteId, getSaleFlowRequirements } from '@/lib/sales/sale-flow';
import type { SaleFlowFieldErrors } from '@/lib/sales/sale-validation';
import { cn } from '@/lib/utils';

interface PaymentMeta {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const PAYMENT_META: Record<SaleFlowPaymentType, PaymentMeta> = {
    CASH: {
        label: 'เงินสด',
        description: 'รับชำระเป็นเงินสด',
        icon: Banknote,
    },
    CREDIT: {
        label: 'เงินเชื่อ',
        description: 'ผูกลูกค้า รถ และเลขบิล',
        icon: ReceiptText,
    },
    TRANSFER: {
        label: 'โอนเงิน',
        description: 'รับชำระผ่านการโอน',
        icon: Landmark,
    },
    BOX_TRUCK: {
        label: 'รถตู้ทึบ',
        description: 'รายการเครดิตกลุ่มรถตู้ทึบ',
        icon: Truck,
    },
    OIL_TRUCK_SUPACHAI: {
        label: 'รถน้ำมันศุภชัย',
        description: 'รายการเครดิตรถน้ำมันศุภชัย',
        icon: Building2,
    },
    CREDIT_CARD: {
        label: 'บัตรเครดิต',
        description: 'รับชำระด้วยบัตรเครดิต',
        icon: CreditCard,
    },
};

export interface PaymentStepProps {
    capabilities: SaleFlowCapabilities;
    value: SaleFlowPaymentSelection;
    evidence: SaleFlowEvidence;
    onChange: (value: SaleFlowPaymentSelection) => void;
    onEvidenceChange: (value: SaleFlowEvidence) => void;
    transferProofFile: File | null;
    onTransferProofFileChange: (file: File | null) => void;
    errors?: SaleFlowFieldErrors;
    disabled?: boolean;
}

export function PaymentStep({
    capabilities,
    value,
    evidence,
    onChange,
    onEvidenceChange,
    transferProofFile,
    onTransferProofFileChange,
    errors,
    disabled = false,
}: PaymentStepProps) {
    const [nextBillLoading, setNextBillLoading] = React.useState(false);
    const [nextBillMessage, setNextBillMessage] = React.useState<string | null>(null);
    const [transferFileError, setTransferFileError] = React.useState<string | null>(null);
    const transferInputRef = React.useRef<HTMLInputElement>(null);
    const requirements = getSaleFlowRequirements(capabilities, value.type);
    const hasTransferProof = Boolean(transferProofFile || evidence.transferProofUrl);

    const selectPaymentType = (paymentType: SaleFlowPaymentType) => {
        if (disabled || paymentType === value.type) return;
        onChange({ ...value, type: paymentType });
        setNextBillMessage(null);
    };

    const fillNextBillNumber = async () => {
        if (capabilities.stationId !== 'station-1') return;

        setNextBillLoading(true);
        setNextBillMessage(null);
        try {
            const params = new URLSearchParams({ next: 'true' });
            if (value.billBookNo.trim()) params.set('bookNo', value.billBookNo.trim());

            const response = await fetch(
                `/api/station/${getSaleFlowLegacyRouteId(capabilities.stationId)}/check-bill?${params.toString()}`,
                { cache: 'no-store' }
            );
            if (!response.ok) throw new Error('next_bill_failed');

            const payload = await response.json();
            const nextBookNo = typeof payload.billBookNo === 'string' ? payload.billBookNo : value.billBookNo;
            const nextBillNo = typeof payload.billNo === 'string' ? payload.billNo : '';

            if (nextBillNo) {
                onChange({
                    ...value,
                    billBookNo: nextBookNo,
                    billNo: nextBillNo,
                });
                setNextBillMessage(`เลขถัดไป: ${nextBookNo || '-'} / ${nextBillNo}`);
            } else {
                setNextBillMessage('ยังไม่มีเล่มบิลล่าสุด กรุณากรอกเล่มที่ก่อน แล้วลองอีกครั้ง');
            }
        } catch {
            setNextBillMessage('สร้างเลขบิลถัดไปไม่สำเร็จ สามารถกรอกเองได้');
        } finally {
            setNextBillLoading(false);
        }
    };

    const handleTransferFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setTransferFileError(null);

        if (file && !file.type.startsWith('image/')) {
            setTransferFileError('รองรับไฟล์รูปภาพเท่านั้น');
            event.target.value = '';
            return;
        }
        if (file && file.size > 8 * 1024 * 1024) {
            setTransferFileError('ไฟล์ต้องมีขนาดไม่เกิน 8 MB');
            event.target.value = '';
            return;
        }

        onTransferProofFileChange(file);
        if (file && evidence.transferProofUrl) {
            onEvidenceChange({ transferProofUrl: null });
        }
    };

    const clearTransferProof = () => {
        onTransferProofFileChange(null);
        if (transferInputRef.current) transferInputRef.current.value = '';
        setTransferFileError(null);
        if (evidence.transferProofUrl) {
            onEvidenceChange({ transferProofUrl: null });
        }
    };

    return (
        <Section
            title="วิธีชำระ"
            description="เลือกวิธีชำระก่อน ระบบจะแสดงเฉพาะข้อมูลที่จำเป็นสำหรับรายการนี้"
        >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {capabilities.allowedPaymentTypes.map((paymentType) => {
                    const meta = PAYMENT_META[paymentType];
                    const Icon = meta.icon;
                    const selected = value.type === paymentType;

                    return (
                        <button
                            key={paymentType}
                            type="button"
                            onClick={() => selectPaymentType(paymentType)}
                            disabled={disabled}
                            aria-pressed={selected}
                            className={cn(
                                'flex min-h-[var(--ui-touch-target)] items-start gap-3 rounded-[var(--ui-radius-md)] border p-3 text-left transition-colors',
                                'focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50',
                                selected
                                    ? 'border-[var(--ui-primary-500)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                                    : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-subtle)]'
                            )}
                        >
                            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0">
                                <span className="block text-sm font-bold">{meta.label}</span>
                                <span className="mt-0.5 block text-xs text-[var(--ui-text-muted)]">
                                    {meta.description}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {errors?.paymentType && (
                <div className="mt-3">
                    <Notice tone="danger">{errors.paymentType}</Notice>
                </div>
            )}

            {requirements.showCustomerStep && (
                <div className="mt-4">
                    <Notice tone="info" title="รายการนี้ต้องผูกลูกค้าและรถ">
                        เลือกลูกค้าและทะเบียนรถให้ครบก่อนบันทึก จากนั้นระบุเล่มที่และเลขที่บิลด้านล่าง
                    </Notice>
                </div>
            )}

            {requirements.requiresBill && (
                <div className="mt-4 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-bold">ข้อมูลบิลเงินเชื่อ</div>
                            <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                ต้องมีทั้งเล่มที่และเลขที่บิลก่อนบันทึก
                            </div>
                        </div>
                        {capabilities.stationId === 'station-1' && (
                            <Button
                                variant="outline"
                                size="sm"
                                loading={nextBillLoading}
                                disabled={disabled}
                                onClick={() => void fillNextBillNumber()}
                            >
                                เลขถัดไป
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            label="เล่มที่"
                            requiredMark
                            value={value.billBookNo}
                            onChange={(event) => onChange({ ...value, billBookNo: event.target.value })}
                            disabled={disabled}
                            autoComplete="off"
                            inputMode="numeric"
                            placeholder="เช่น 12"
                            error={errors?.billBookNo}
                        />
                        <Input
                            label="เลขที่บิล"
                            requiredMark
                            value={value.billNo}
                            onChange={(event) => onChange({ ...value, billNo: event.target.value })}
                            disabled={disabled}
                            autoComplete="off"
                            inputMode="numeric"
                            placeholder="เช่น 0345"
                            error={errors?.billNo}
                        />
                    </div>

                    {nextBillMessage && (
                        <div className="mt-2 text-xs text-[var(--ui-text-muted)]" aria-live="polite">
                            {nextBillMessage}
                        </div>
                    )}
                </div>
            )}

            {value.type === 'TRANSFER' && capabilities.transferEvidence === 'REQUIRED' && (
                <div className="mt-4 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                    <div className="mb-3 flex items-start gap-3">
                        <Upload className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ui-primary-text)]" aria-hidden="true" />
                        <div>
                            <div className="text-sm font-bold">หลักฐานการโอน</div>
                            <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                แท๊งลอยบังคับแนบรูปสลิปก่อนบันทึก สูงสุด 8 MB
                            </div>
                        </div>
                    </div>

                    <Input
                        ref={transferInputRef}
                        type="file"
                        label="รูปสลิปการโอน"
                        accept="image/*"
                        requiredMark
                        disabled={disabled}
                        onChange={handleTransferFileChange}
                        error={transferFileError || errors?.transferProof}
                        helperText={hasTransferProof ? undefined : 'รองรับไฟล์รูปภาพ ขนาดไม่เกิน 8 MB'}
                    />

                    {hasTransferProof && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] px-3 py-2 text-sm">
                            <span className="min-w-0 truncate font-semibold">
                                {transferProofFile?.name || 'มีหลักฐานการโอนแล้ว'}
                            </span>
                            <Button variant="ghost" size="sm" onClick={clearTransferProof} disabled={disabled}>
                                เอาออก
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {value.type === 'TRANSFER' && capabilities.transferEvidence === 'OPTIONAL' && (
                <div className="mt-4">
                    <Notice tone="info" title="ปั๊มแก๊สไม่บังคับสลิปโอนเงิน">
                        ระบบ GAS ปัจจุบันยังไม่ได้บันทึกหลักฐานการโอน จึงไม่แสดงช่องอัปโหลดในขั้นตอนนี้
                    </Notice>
                </div>
            )}
        </Section>
    );
}
