'use client';

import * as React from 'react';
import { Button, Notice } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
    createEmptySaleDraft,
    getSaleFlowCapabilities,
    getSaleFlowRequirements,
    type SaleFlowDraft,
    type SaleFlowPaymentType,
    type SaleFlowStationContext,
} from '@/lib/sales/sale-flow';
import {
    SaleFlowSubmissionError,
    submitSaleFlowDraft,
} from '@/lib/sales/sale-api';
import {
    validateSaleFlowDraft,
    type SaleFlowFieldErrors,
} from '@/lib/sales/sale-validation';
import { CustomerTruckStep } from './CustomerTruckStep';
import { FuelQuantityStep, type SaleFlowPriceContext } from './FuelQuantityStep';
import { PaymentStep } from './PaymentStep';
import { SaleReviewStep } from './SaleReviewStep';

export interface SaleFlowFormProps {
    station: SaleFlowStationContext;
    prices: SaleFlowPriceContext;
    userRole: 'ADMIN' | 'STAFF';
    initialPaymentType?: SaleFlowPaymentType;
    disabled?: boolean;
    onSuccess?: (result: unknown, draft: SaleFlowDraft) => void;
}

export function SaleFlowForm({
    station,
    prices,
    userRole,
    initialPaymentType = 'CASH',
    disabled = false,
    onSuccess,
}: SaleFlowFormProps) {
    const capabilities = getSaleFlowCapabilities(station.stationId);
    const {
        stationId,
        stationName,
        stationType,
        stationNumber,
        businessDate,
        shiftId,
        shiftNumber,
    } = station;
    const [draft, setDraft] = React.useState<SaleFlowDraft>(() =>
        createEmptySaleDraft(station, initialPaymentType)
    );
    const [transferProofFile, setTransferProofFile] = React.useState<File | null>(null);
    const [errors, setErrors] = React.useState<SaleFlowFieldErrors>({});
    const [submitting, setSubmitting] = React.useState(false);
    const formRef = React.useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    const focusFirstInvalid = React.useCallback(() => {
        window.setTimeout(() => {
            formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-sale-invalid="true"]')?.focus();
        }, 0);
    }, []);

    React.useEffect(() => {
        setDraft(createEmptySaleDraft({
            stationId,
            stationName,
            stationType,
            stationNumber,
            businessDate,
            shiftId,
            shiftNumber,
        }, initialPaymentType));
        setTransferProofFile(null);
        setErrors({});
    }, [
        businessDate,
        initialPaymentType,
        shiftId,
        shiftNumber,
        stationId,
        stationName,
        stationNumber,
        stationType,
    ]);

    if (!capabilities) {
        return (
            <Notice tone="warning" title="สถานีนี้ไม่มี flow บันทึกขายใหม่">
                หน้า redesign เปิดบันทึกขายเฉพาะ station-1, station-5 และ station-6 เท่านั้น
            </Notice>
        );
    }

    const requirements = getSaleFlowRequirements(capabilities, draft.payment.type);
    const hasTransferProof = Boolean(draft.evidence.transferProofUrl || transferProofFile);

    const updateCustomer: React.ComponentProps<typeof CustomerTruckStep>['onChange'] = (customer) => {
        setDraft((current) => ({ ...current, customer }));
        setErrors((current) => ({
            ...current,
            owner: undefined,
            truck: undefined,
            licensePlate: undefined,
        }));
    };

    const updateFuel: React.ComponentProps<typeof FuelQuantityStep>['onChange'] = (item) => {
        setDraft((current) => ({ ...current, item }));
        setErrors((current) => ({
            ...current,
            nozzle: undefined,
            liters: undefined,
            pricePerLiter: undefined,
            amount: undefined,
        }));
    };

    const updatePayment: React.ComponentProps<typeof PaymentStep>['onChange'] = (payment) => {
        setDraft((current) => ({ ...current, payment }));
        setErrors((current) => ({
            ...current,
            paymentType: undefined,
            billBookNo: undefined,
            billNo: undefined,
            transferProof: undefined,
        }));
    };

    const updateEvidence: React.ComponentProps<typeof PaymentStep>['onEvidenceChange'] = (evidence) => {
        setDraft((current) => ({ ...current, evidence }));
        setErrors((current) => ({ ...current, transferProof: undefined }));
    };

    const updateTransferProofFile = (file: File | null) => {
        setTransferProofFile(file);
        if (file) {
            setErrors((current) => ({ ...current, transferProof: undefined }));
        }
    };

    const handleSubmit = async () => {
        if (submitting || disabled) return;

        const validation = validateSaleFlowDraft(draft, capabilities, { hasTransferProof });
        setErrors(validation.errors);
        if (!validation.valid) {
            showToast('error', 'ข้อมูลยังไม่ครบ กรุณาตรวจช่องที่แจ้งเตือน');
            focusFirstInvalid();
            return;
        }

        setSubmitting(true);
        try {
            const submittedDraft = draft;
            const result = await submitSaleFlowDraft({
                draft: submittedDraft,
                capabilities,
                transferProofFile,
            });

            showToast('success', 'บันทึกรายการขายเรียบร้อย');
            onSuccess?.(result, submittedDraft);
            setDraft(createEmptySaleDraft(station, initialPaymentType));
            setTransferProofFile(null);
            setErrors({});
        } catch (error) {
            if (error instanceof SaleFlowSubmissionError) {
                if (error.fieldErrors) {
                    setErrors(error.fieldErrors);
                    focusFirstInvalid();
                }
                showToast('error', error.message);
            } else {
                showToast('error', 'เกิดข้อผิดพลาดระหว่างบันทึกรายการขาย');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div ref={formRef} className="space-y-4">
            <FuelQuantityStep
                value={draft.item}
                onChange={updateFuel}
                capabilities={capabilities}
                paymentType={draft.payment.type}
                prices={prices}
                errors={errors}
                disabled={disabled || submitting}
            />

            <PaymentStep
                capabilities={capabilities}
                value={draft.payment}
                evidence={draft.evidence}
                onChange={updatePayment}
                onEvidenceChange={updateEvidence}
                transferProofFile={transferProofFile}
                onTransferProofFileChange={updateTransferProofFile}
                errors={errors}
                disabled={disabled || submitting}
            />

            {requirements.showCustomerStep && (
                <CustomerTruckStep
                    value={draft.customer}
                    onChange={updateCustomer}
                    truckSelection={capabilities.truckSelection}
                    userRole={userRole}
                    required={requirements.requiresCustomer}
                    errors={errors}
                    disabled={disabled || submitting}
                />
            )}

            <SaleReviewStep
                draft={draft}
                capabilities={capabilities}
                hasTransferProof={hasTransferProof}
            />

            <div
                className="sticky z-[var(--ui-z-sticky)] -mx-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none lg:static"
                style={{ bottom: 'calc(var(--ui-bottom-nav-height) + env(safe-area-inset-bottom))' }}
            >
                <Button
                    size="lg"
                    loading={submitting}
                    disabled={disabled}
                    onClick={() => void handleSubmit()}
                    className="w-full sm:w-auto sm:min-w-48"
                >
                    ตรวจแล้ว บันทึกรายการ
                </Button>
            </div>
        </div>
    );
}
