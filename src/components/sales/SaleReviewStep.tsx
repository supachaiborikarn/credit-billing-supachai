import { AlertTriangle, CheckCircle2, Fuel, ReceiptText, UserRound } from 'lucide-react';
import { Notice, Section } from '@/components/ui';
import type {
    SaleFlowCapabilities,
    SaleFlowDraft,
    SaleFlowPaymentType,
} from '@/lib/sales/sale-flow';
import { getSaleFlowRequirements } from '@/lib/sales/sale-flow';
import { validateSaleFlowDraft } from '@/lib/sales/sale-validation';
import { formatCurrency, formatNumber } from '@/utils/formatters';

const PAYMENT_LABELS: Record<SaleFlowPaymentType, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    BOX_TRUCK: 'รถตู้ทึบ',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
    CREDIT_CARD: 'บัตรเครดิต',
};

export interface SaleReviewStepProps {
    draft: SaleFlowDraft;
    capabilities: SaleFlowCapabilities;
    hasTransferProof?: boolean;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0">
            <span className="text-[var(--ui-text-muted)]">{label}</span>
            <span className="text-right font-semibold text-[var(--ui-text)]">{value}</span>
        </div>
    );
}

export function SaleReviewStep({
    draft,
    capabilities,
    hasTransferProof = false,
}: SaleReviewStepProps) {
    const validation = validateSaleFlowDraft(draft, capabilities, { hasTransferProof });
    const requirements = getSaleFlowRequirements(capabilities, draft.payment.type);
    const errorMessages = Array.from(new Set(Object.values(validation.errors).filter(Boolean)));
    const liters = draft.item.liters && draft.item.liters > 0 ? draft.item.liters : 0;
    const price = draft.item.pricePerLiter && draft.item.pricePerLiter > 0 ? draft.item.pricePerLiter : 0;
    const amount = draft.item.amount && draft.item.amount > 0 ? draft.item.amount : 0;

    return (
        <Section
            title="ตรวจสอบก่อนบันทึก"
            description="ตรวจยอดและข้อมูลสำคัญอีกครั้งก่อนส่งไปบันทึกในระบบเดิม"
        >
            {!validation.valid ? (
                <Notice tone="danger" title="ยังบันทึกไม่ได้" icon={AlertTriangle}>
                    <ul className="list-disc space-y-1 pl-5">
                        {errorMessages.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                </Notice>
            ) : (
                <Notice tone="success" title="ข้อมูลพร้อมบันทึก" icon={CheckCircle2}>
                    ข้อมูลที่จำเป็นครบแล้ว ขั้นตอนถัดไปสามารถส่งรายการไปยัง API ของสถานีได้
                </Notice>
            )}

            <div className="mt-4 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4 sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">
                    ยอดที่บันทึก
                </div>
                <div className="mt-1 text-4xl font-extrabold tabular-nums text-[var(--ui-text)] sm:text-5xl">
                    ฿{formatCurrency(amount)}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--ui-text-secondary)]">
                    <span><strong className="text-[var(--ui-text)]">{formatNumber(liters, { decimals: 5 })}</strong> ลิตร</span>
                    <span>× ฿<strong className="text-[var(--ui-text)]">{formatCurrency(price)}</strong>/ลิตร</span>
                </div>
                {capabilities.entryMode === 'AMOUNT' && (
                    <div className="mt-2 text-xs text-[var(--ui-text-muted)]">
                        ปั๊มแก๊สจะให้ backend คำนวณลิตรจากราคาประจำวันซ้ำอีกครั้งตอนบันทึก
                    </div>
                )}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                        <Fuel className="h-4 w-4 text-[var(--ui-primary-text)]" aria-hidden="true" />
                        รายการขาย
                    </div>
                    <div className="divide-y divide-[var(--ui-border)]">
                        <SummaryRow label="สถานี" value={draft.station.stationName} />
                        <SummaryRow label="วันที่ธุรกิจ" value={draft.station.businessDate} />
                        <SummaryRow label="สินค้า" value={draft.item.productType === 'LPG' ? 'แก๊ส LPG' : 'น้ำมันดีเซล'} />
                        {capabilities.requiresNozzle && (
                            <SummaryRow label="หัวจ่าย" value={draft.item.nozzleNumber ? `หัว ${draft.item.nozzleNumber}` : '-'} />
                        )}
                        <SummaryRow label="วิธีชำระ" value={PAYMENT_LABELS[draft.payment.type]} />
                    </div>
                </div>

                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                        {requirements.requiresCustomer ? (
                            <UserRound className="h-4 w-4 text-[var(--ui-primary-text)]" aria-hidden="true" />
                        ) : (
                            <ReceiptText className="h-4 w-4 text-[var(--ui-primary-text)]" aria-hidden="true" />
                        )}
                        ข้อมูลประกอบ
                    </div>
                    <div className="divide-y divide-[var(--ui-border)]">
                        {requirements.requiresCustomer && (
                            <>
                                <SummaryRow label="ลูกค้า" value={draft.customer.ownerName || '-'} />
                                <SummaryRow label="ทะเบียน" value={draft.customer.licensePlate || '-'} />
                            </>
                        )}
                        {requirements.requiresBill && (
                            <SummaryRow
                                label="เลขบิล"
                                value={`${draft.payment.billBookNo || '-'} / ${draft.payment.billNo || '-'}`}
                            />
                        )}
                        {draft.payment.type === 'TRANSFER' && capabilities.transferEvidence === 'REQUIRED' && (
                            <SummaryRow label="หลักฐานโอน" value={hasTransferProof ? 'แนบแล้ว' : 'ยังไม่ได้แนบ'} />
                        )}
                        {!requirements.requiresCustomer
                            && !requirements.requiresBill
                            && draft.payment.type !== 'TRANSFER' && (
                                <SummaryRow label="ข้อมูลเพิ่มเติม" value="ไม่ต้องกรอก" />
                            )}
                    </div>
                </div>
            </div>
        </Section>
    );
}
