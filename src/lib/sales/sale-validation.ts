import type {
    SaleFlowCapabilities,
    SaleFlowDraft,
    SaleFlowPaymentType,
} from './sale-flow';
import { getSaleFlowRequirements } from './sale-flow';

export interface SaleFlowFieldErrors {
    shift?: string;
    owner?: string;
    truck?: string;
    licensePlate?: string;
    nozzle?: string;
    liters?: string;
    pricePerLiter?: string;
    amount?: string;
    paymentType?: string;
    billBookNo?: string;
    billNo?: string;
    transferProof?: string;
}

export interface SaleFlowValidationResult {
    valid: boolean;
    errors: SaleFlowFieldErrors;
}

export interface SaleFlowValidationOptions {
    hasTransferProof?: boolean;
}

function isPositive(value: number | null): value is number {
    return value !== null && Number.isFinite(value) && value > 0;
}

function isAllowedPayment(
    allowed: readonly SaleFlowPaymentType[],
    paymentType: SaleFlowPaymentType
) {
    return allowed.includes(paymentType);
}

export function validateSaleFlowDraft(
    draft: SaleFlowDraft,
    capabilities: SaleFlowCapabilities,
    options: SaleFlowValidationOptions = {}
): SaleFlowValidationResult {
    const errors: SaleFlowFieldErrors = {};
    const requirements = getSaleFlowRequirements(capabilities, draft.payment.type);

    if (!draft.station.shiftId.trim()) {
        errors.shift = 'ต้องมีกะที่เปิดอยู่ก่อนบันทึกรายการ';
    }

    if (!isAllowedPayment(capabilities.allowedPaymentTypes, draft.payment.type)) {
        errors.paymentType = 'วิธีชำระนี้ใช้กับสถานีนี้ไม่ได้';
    }

    if (requirements.requiresCustomer && !draft.customer.ownerId) {
        errors.owner = 'กรุณาเลือกลูกค้า';
    }

    if (requirements.requiresTruck) {
        if (!draft.customer.licensePlate.trim()) {
            errors.licensePlate = 'กรุณาเลือกหรือกรอกทะเบียนรถ';
        }
        if (capabilities.truckSelection === 'EXISTING_ONLY' && !draft.customer.truckId) {
            errors.truck = 'ต้องเลือกรถที่มีอยู่ในระบบ';
        }
    }

    if (capabilities.requiresNozzle) {
        const nozzle = draft.item.nozzleNumber;
        if (!nozzle || ![1, 2, 3, 4].includes(nozzle)) {
            errors.nozzle = 'กรุณาเลือกหัวจ่าย 1–4';
        }
    }

    if (!isPositive(draft.item.pricePerLiter)) {
        errors.pricePerLiter = 'ราคาต่อลิตรต้องมากกว่า 0';
    }

    if (capabilities.entryMode === 'LITERS') {
        if (!isPositive(draft.item.liters)) {
            errors.liters = 'จำนวนลิตรต้องมากกว่า 0';
        }
        if (!isPositive(draft.item.amount)) {
            errors.amount = 'ยอดเงินต้องมากกว่า 0';
        }

        if (
            isPositive(draft.item.liters)
            && isPositive(draft.item.pricePerLiter)
            && isPositive(draft.item.amount)
        ) {
            const expectedAmount = draft.item.liters * draft.item.pricePerLiter;
            if (Math.abs(expectedAmount - draft.item.amount) > 0.01) {
                errors.amount = 'ยอดเงินไม่ตรงกับจำนวนลิตร × ราคาต่อลิตร';
            }
        }
    } else {
        if (!isPositive(draft.item.amount)) {
            errors.amount = 'ยอดเงินขายต้องมากกว่า 0';
        }
        if (!isPositive(draft.item.liters)) {
            errors.liters = 'ยังคำนวณจำนวนลิตรไม่ได้';
        }
    }

    if (requirements.requiresBill) {
        if (!draft.payment.billBookNo.trim()) {
            errors.billBookNo = 'กรุณากรอกเล่มที่';
        }
        if (!draft.payment.billNo.trim()) {
            errors.billNo = 'กรุณากรอกเลขที่บิล';
        }
    }

    if (requirements.requiresTransferProof && !options.hasTransferProof) {
        errors.transferProof = 'กรุณาแนบรูปหลักฐานการโอน';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}
