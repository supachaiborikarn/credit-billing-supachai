import { describe, expect, it } from 'vitest';
import {
    createEmptySaleDraft,
    getSaleFlowCapabilities,
    type SaleFlowDraft,
    type SaleFlowStationContext,
} from '../src/lib/sales/sale-flow';
import { validateSaleFlowDraft } from '../src/lib/sales/sale-validation';

function stationContext(
    stationId: 'station-1' | 'station-5',
    stationType: 'FULL' | 'GAS'
): SaleFlowStationContext {
    return {
        stationId,
        stationName: stationId === 'station-1' ? 'แท๊งลอยวัชรเกียรติ' : 'ปั๊มแก๊สพงษ์อนันต์',
        stationType,
        stationNumber: stationId === 'station-1' ? 1 : 5,
        businessDate: '2026-08-26',
        shiftId: 'shift-open',
    };
}

function fullDraft(): SaleFlowDraft {
    const draft = createEmptySaleDraft(stationContext('station-1', 'FULL'), 'CASH');
    draft.item = {
        kind: 'FUEL',
        productType: 'DIESEL',
        nozzleNumber: 1,
        liters: 100,
        pricePerLiter: 31.34,
        amount: 3134,
    };
    return draft;
}

function gasDraft(): SaleFlowDraft {
    const draft = createEmptySaleDraft(stationContext('station-5', 'GAS'), 'CASH');
    draft.item = {
        kind: 'FUEL',
        productType: 'LPG',
        nozzleNumber: null,
        liters: 62.1504,
        pricePerLiter: 16.09,
        amount: 1000,
    };
    return draft;
}

describe('sale flow validation', () => {
    it('accepts a complete FULL cash sale and rejects a mismatched amount', () => {
        const capabilities = getSaleFlowCapabilities('station-1')!;
        const draft = fullDraft();

        expect(validateSaleFlowDraft(draft, capabilities).valid).toBe(true);

        draft.item.amount = 3000;
        const mismatch = validateSaleFlowDraft(draft, capabilities);
        expect(mismatch.valid).toBe(false);
        expect(mismatch.errors.amount).toContain('จำนวนลิตร');
    });

    it('allows FULL credit to use a new plate for an existing owner', () => {
        const capabilities = getSaleFlowCapabilities('station-1')!;
        const draft = fullDraft();
        draft.payment.type = 'CREDIT';
        draft.payment.billBookNo = '12';
        draft.payment.billNo = '0345';
        draft.customer.ownerId = 'owner-1';
        draft.customer.ownerName = 'ลูกค้าทดสอบ';
        draft.customer.truckId = null;
        draft.customer.licensePlate = '1กข 1234';

        const result = validateSaleFlowDraft(draft, capabilities);
        expect(result.valid).toBe(true);
        expect(result.errors.truck).toBeUndefined();
    });

    it('requires an existing truck for GAS credit', () => {
        const capabilities = getSaleFlowCapabilities('station-5')!;
        const draft = gasDraft();
        draft.payment.type = 'CREDIT';
        draft.payment.billBookNo = '3';
        draft.payment.billNo = '100';
        draft.customer.ownerId = 'owner-1';
        draft.customer.ownerName = 'ลูกค้าทดสอบ';
        draft.customer.licensePlate = '70-1234';

        const missingTruck = validateSaleFlowDraft(draft, capabilities);
        expect(missingTruck.valid).toBe(false);
        expect(missingTruck.errors.truck).toContain('รถที่มีอยู่');

        draft.customer.truckId = 'truck-1';
        expect(validateSaleFlowDraft(draft, capabilities).valid).toBe(true);
    });

    it('requires transfer proof for FULL but not for GAS', () => {
        const fullCapabilities = getSaleFlowCapabilities('station-1')!;
        const full = fullDraft();
        full.payment.type = 'TRANSFER';

        expect(validateSaleFlowDraft(full, fullCapabilities).errors.transferProof).toBeTruthy();
        expect(validateSaleFlowDraft(full, fullCapabilities, { hasTransferProof: true }).valid).toBe(true);

        const gasCapabilities = getSaleFlowCapabilities('station-5')!;
        const gas = gasDraft();
        gas.payment.type = 'TRANSFER';
        const gasResult = validateSaleFlowDraft(gas, gasCapabilities);
        expect(gasResult.valid).toBe(true);
        expect(gasResult.errors.transferProof).toBeUndefined();
    });
});
