import type {
    SaleFlowCapabilities,
    SaleFlowDraft,
    SaleFlowPaymentType,
} from './sale-flow';
import {
    getSaleFlowLegacyRouteId,
    getSaleFlowRequirements,
} from './sale-flow';
import type { SaleFlowFieldErrors } from './sale-validation';
import { validateSaleFlowDraft } from './sale-validation';

export interface FullSaleRequestBody {
    date: string;
    nozzleNumber: number;
    paymentType: SaleFlowPaymentType;
    licensePlate: string;
    ownerName: string;
    ownerCode: string;
    ownerId: string | null;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo: string;
    billNo: string;
    transferProofUrl: string | null;
}

export interface GasSaleRequestBody {
    paymentType: 'CASH' | 'CREDIT' | 'CREDIT_CARD' | 'TRANSFER';
    amount: number;
    ownerId: string | null;
    truckId: string | null;
    licensePlate: string | null;
    bookNo: string | null;
    billNo: string | null;
    notes: string | null;
}

export type SaleFlowRequest =
    | { kind: 'FULL'; endpoint: string; body: FullSaleRequestBody }
    | { kind: 'GAS'; endpoint: string; body: GasSaleRequestBody };

export type SaleFlowFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class SaleFlowSubmissionError extends Error {
    status?: number;
    fieldErrors?: SaleFlowFieldErrors;

    constructor(message: string, options: { status?: number; fieldErrors?: SaleFlowFieldErrors } = {}) {
        super(message);
        this.name = 'SaleFlowSubmissionError';
        this.status = options.status;
        this.fieldErrors = options.fieldErrors;
    }
}

function requiredNumber(value: number | null, field: string): number {
    if (value === null || !Number.isFinite(value)) {
        throw new SaleFlowSubmissionError(`Missing numeric field: ${field}`);
    }
    return value;
}

export function buildSaleFlowRequest(
    draft: SaleFlowDraft,
    capabilities: SaleFlowCapabilities,
    transferProofUrl: string | null = draft.evidence.transferProofUrl
): SaleFlowRequest {
    if (draft.station.stationId !== capabilities.stationId) {
        throw new SaleFlowSubmissionError('Station capability does not match sale draft');
    }

    const routeId = getSaleFlowLegacyRouteId(capabilities.stationId);
    const requirements = getSaleFlowRequirements(capabilities, draft.payment.type);

    if (capabilities.stationType === 'FULL') {
        return {
            kind: 'FULL',
            endpoint: `/api/station/${routeId}/transactions`,
            body: {
                date: draft.station.businessDate,
                nozzleNumber: requiredNumber(draft.item.nozzleNumber, 'nozzleNumber'),
                paymentType: draft.payment.type,
                licensePlate: requirements.requiresTruck ? draft.customer.licensePlate.trim() : '',
                ownerName: requirements.requiresCustomer ? draft.customer.ownerName.trim() : '',
                ownerCode: requirements.requiresCustomer ? (draft.customer.ownerCode || '').trim() : '',
                ownerId: requirements.requiresCustomer ? draft.customer.ownerId : null,
                liters: requiredNumber(draft.item.liters, 'liters'),
                pricePerLiter: requiredNumber(draft.item.pricePerLiter, 'pricePerLiter'),
                amount: requiredNumber(draft.item.amount, 'amount'),
                billBookNo: requirements.requiresBill ? draft.payment.billBookNo.trim() : '',
                billNo: requirements.requiresBill ? draft.payment.billNo.trim() : '',
                transferProofUrl: draft.payment.type === 'TRANSFER' ? transferProofUrl : null,
            },
        };
    }

    if (
        draft.payment.type === 'BOX_TRUCK'
        || draft.payment.type === 'OIL_TRUCK_SUPACHAI'
    ) {
        throw new SaleFlowSubmissionError('Unsupported GAS payment type');
    }

    return {
        kind: 'GAS',
        endpoint: `/api/v2/gas/${routeId}/sell`,
        body: {
            paymentType: draft.payment.type,
            amount: requiredNumber(draft.item.amount, 'amount'),
            ownerId: requirements.requiresCustomer ? draft.customer.ownerId : null,
            truckId: requirements.requiresTruck ? draft.customer.truckId : null,
            licensePlate: requirements.requiresTruck ? draft.customer.licensePlate.trim() : null,
            bookNo: requirements.requiresBill ? draft.payment.billBookNo.trim() : null,
            billNo: requirements.requiresBill ? draft.payment.billNo.trim() : null,
            notes: draft.payment.notes.trim() || null,
        },
    };
}

export async function uploadSaleTransferProof(
    file: File,
    fetchImpl: SaleFlowFetch = fetch
): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new SaleFlowSubmissionError('หลักฐานการโอนต้องเป็นไฟล์รูปภาพ');
    }
    if (file.size > 8 * 1024 * 1024) {
        throw new SaleFlowSubmissionError('หลักฐานการโอนต้องมีขนาดไม่เกิน 8 MB');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'transfer_proof');

    const response = await fetchImpl('/api/upload/transfer-proof', {
        method: 'POST',
        body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.url) {
        throw new SaleFlowSubmissionError(
            payload?.error || 'อัปโหลดหลักฐานการโอนไม่สำเร็จ',
            { status: response.status }
        );
    }

    return payload.url as string;
}

export interface SubmitSaleFlowInput {
    draft: SaleFlowDraft;
    capabilities: SaleFlowCapabilities;
    transferProofFile?: File | null;
    fetchImpl?: SaleFlowFetch;
}

export async function submitSaleFlowDraft({
    draft,
    capabilities,
    transferProofFile = null,
    fetchImpl = fetch,
}: SubmitSaleFlowInput): Promise<unknown> {
    const requirements = getSaleFlowRequirements(capabilities, draft.payment.type);
    const hasTransferProof = Boolean(draft.evidence.transferProofUrl || transferProofFile);
    const validation = validateSaleFlowDraft(draft, capabilities, { hasTransferProof });

    if (!validation.valid) {
        throw new SaleFlowSubmissionError('ข้อมูลรายการขายยังไม่ครบ', {
            fieldErrors: validation.errors,
        });
    }

    let transferProofUrl = draft.evidence.transferProofUrl;
    if (requirements.requiresTransferProof && !transferProofUrl && transferProofFile) {
        transferProofUrl = await uploadSaleTransferProof(transferProofFile, fetchImpl);
    }

    const request = buildSaleFlowRequest(draft, capabilities, transferProofUrl);
    const response = await fetchImpl(request.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new SaleFlowSubmissionError(
            payload?.error || 'บันทึกรายการขายไม่สำเร็จ',
            { status: response.status }
        );
    }

    return payload;
}
