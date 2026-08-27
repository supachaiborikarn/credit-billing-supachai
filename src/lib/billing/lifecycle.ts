export type BillingPipelineStage =
    | 'WAITING_TO_BILL'
    | 'PREPARING_DOCUMENTS'
    | 'BILLED'
    | 'AWAITING_PAYMENT'
    | 'PARTIAL'
    | 'CLOSED';

export type BillingPipelinePersistence =
    | 'DERIVED_FROM_EXISTING_DATA'
    | 'EXPLICIT_SIGNAL_REQUIRED';

export interface BillingPipelineStageDefinition {
    stage: BillingPipelineStage;
    label: string;
    description: string;
    persistence: BillingPipelinePersistence;
}

export const BILLING_PIPELINE_STAGES: readonly BillingPipelineStageDefinition[] = [
    {
        stage: 'WAITING_TO_BILL',
        label: 'รอวางบิล',
        description: 'รายการเครดิตที่ยังไม่ได้ผูกเข้าเอกสารเรียกเก็บเงิน',
        persistence: 'DERIVED_FROM_EXISTING_DATA',
    },
    {
        stage: 'PREPARING_DOCUMENTS',
        label: 'เตรียมเอกสาร',
        description: 'กำลังจัดรายการและตรวจเอกสารก่อนนำไปวางบิล',
        persistence: 'EXPLICIT_SIGNAL_REQUIRED',
    },
    {
        stage: 'BILLED',
        label: 'วางบิลแล้ว',
        description: 'เอกสารถูกส่งหรือวางบิลให้ลูกค้าแล้ว แต่ยังไม่เริ่มรับเงิน',
        persistence: 'EXPLICIT_SIGNAL_REQUIRED',
    },
    {
        stage: 'AWAITING_PAYMENT',
        label: 'รอรับเงิน',
        description: 'มีเอกสารเรียกเก็บเงินแล้วและยังไม่มีการชำระที่ยืนยัน',
        persistence: 'DERIVED_FROM_EXISTING_DATA',
    },
    {
        stage: 'PARTIAL',
        label: 'จ่ายบางส่วน',
        description: 'มียอดชำระแล้ว แต่ยังเหลือยอดคงค้าง',
        persistence: 'DERIVED_FROM_EXISTING_DATA',
    },
    {
        stage: 'CLOSED',
        label: 'ปิดยอด',
        description: 'ยอดชำระที่ยืนยันครบตามยอดเอกสารแล้ว',
        persistence: 'DERIVED_FROM_EXISTING_DATA',
    },
] as const;

export const BILLING_SETTLEMENT_TOLERANCE = 0.01;

export interface BillingSettlementInput {
    totalAmount: number;
    paidAmount: number;
}

export interface BillingDueInput extends BillingSettlementInput {
    dueDate: Date | string | null;
}

export function getBillingPipelineStageDefinition(
    stage: BillingPipelineStage
): BillingPipelineStageDefinition {
    const definition = BILLING_PIPELINE_STAGES.find((item) => item.stage === stage);
    if (!definition) {
        throw new Error(`Unknown billing pipeline stage: ${stage}`);
    }
    return definition;
}

export function deriveBillingSettlementStage({
    totalAmount,
    paidAmount,
}: BillingSettlementInput): 'AWAITING_PAYMENT' | 'PARTIAL' | 'CLOSED' {
    const safeTotal = Number.isFinite(totalAmount) ? Math.max(0, totalAmount) : 0;
    const safePaid = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0;
    const remaining = Math.max(0, safeTotal - safePaid);

    if (safeTotal <= BILLING_SETTLEMENT_TOLERANCE) {
        return 'CLOSED';
    }
    if (remaining <= BILLING_SETTLEMENT_TOLERANCE) {
        return 'CLOSED';
    }
    if (safePaid > BILLING_SETTLEMENT_TOLERANCE) {
        return 'PARTIAL';
    }
    return 'AWAITING_PAYMENT';
}

export function getBillingRemainingAmount({
    totalAmount,
    paidAmount,
}: BillingSettlementInput): number {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return 0;
    const safePaid = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0;
    return Math.max(0, totalAmount - safePaid);
}

export function isBillingOverdue(
    input: BillingDueInput,
    now: Date = new Date()
): boolean {
    if (deriveBillingSettlementStage(input) === 'CLOSED') return false;
    if (!input.dueDate) return false;

    const dueDate = input.dueDate instanceof Date
        ? input.dueDate
        : new Date(input.dueDate);

    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate.getTime() < now.getTime();
}

export function isBillingStageCurrentlyDerivable(stage: BillingPipelineStage): boolean {
    return getBillingPipelineStageDefinition(stage).persistence === 'DERIVED_FROM_EXISTING_DATA';
}
