import { describe, expect, it } from 'vitest';
import {
    createEmptySaleDraft,
    getSaleFlowCapabilities,
    type SaleFlowStationContext,
} from '../src/lib/sales/sale-flow';
import {
    buildSaleFlowRequest,
    submitSaleFlowDraft,
    type SaleFlowFetch,
} from '../src/lib/sales/sale-api';

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

describe('sale flow API adapter', () => {
    it('maps FULL cash to the existing numeric station transaction endpoint', () => {
        const capabilities = getSaleFlowCapabilities('station-1')!;
        const draft = createEmptySaleDraft(stationContext('station-1', 'FULL'), 'CASH');
        draft.customer = {
            ownerId: 'stale-owner',
            ownerName: 'ข้อมูลเดิมที่ไม่ควรถูกส่ง',
            ownerCode: 'OLD',
            truckId: 'stale-truck',
            licensePlate: 'OLD-123',
        };
        draft.item = {
            kind: 'FUEL',
            productType: 'DIESEL',
            nozzleNumber: 2,
            liters: 100,
            pricePerLiter: 31.34,
            amount: 3134,
        };

        expect(buildSaleFlowRequest(draft, capabilities)).toEqual({
            kind: 'FULL',
            endpoint: '/api/station/1/transactions',
            body: {
                date: '2026-08-26',
                nozzleNumber: 2,
                paymentType: 'CASH',
                licensePlate: '',
                ownerName: '',
                ownerCode: '',
                ownerId: null,
                liters: 100,
                pricePerLiter: 31.34,
                amount: 3134,
                billBookNo: '',
                billNo: '',
                transferProofUrl: null,
            },
        });
    });

    it('maps FULL transfer proof without leaking credit fields', () => {
        const capabilities = getSaleFlowCapabilities('station-1')!;
        const draft = createEmptySaleDraft(stationContext('station-1', 'FULL'), 'TRANSFER');
        draft.item = {
            kind: 'FUEL',
            productType: 'DIESEL',
            nozzleNumber: 1,
            liters: 50,
            pricePerLiter: 30.5,
            amount: 1525,
        };

        const request = buildSaleFlowRequest(draft, capabilities, 'https://example.com/slip.webp');
        expect(request.endpoint).toBe('/api/station/1/transactions');
        expect(request.body).toMatchObject({
            paymentType: 'TRANSFER',
            ownerId: null,
            licensePlate: '',
            billBookNo: '',
            billNo: '',
            transferProofUrl: 'https://example.com/slip.webp',
        });
    });

    it('maps GAS sale to amount-only legacy payload and numeric route', () => {
        const capabilities = getSaleFlowCapabilities('station-5')!;
        const draft = createEmptySaleDraft(stationContext('station-5', 'GAS'), 'CASH');
        draft.item = {
            kind: 'FUEL',
            productType: 'LPG',
            nozzleNumber: null,
            liters: 62.1504,
            pricePerLiter: 16.09,
            amount: 1000,
        };
        draft.payment.notes = 'กะเช้า';

        const request = buildSaleFlowRequest(draft, capabilities);
        expect(request).toEqual({
            kind: 'GAS',
            endpoint: '/api/v2/gas/5/sell',
            body: {
                paymentType: 'CASH',
                amount: 1000,
                ownerId: null,
                truckId: null,
                licensePlate: null,
                bookNo: null,
                billNo: null,
                notes: 'กะเช้า',
            },
        });
        expect(request.body).not.toHaveProperty('liters');
        expect(request.body).not.toHaveProperty('pricePerLiter');
    });

    it('maps GAS credit owner/truck/bill fields exactly to the current sell contract', () => {
        const capabilities = getSaleFlowCapabilities('station-5')!;
        const draft = createEmptySaleDraft(stationContext('station-5', 'GAS'), 'CREDIT');
        draft.item = {
            kind: 'FUEL',
            productType: 'LPG',
            nozzleNumber: null,
            liters: 62.1504,
            pricePerLiter: 16.09,
            amount: 1000,
        };
        draft.customer = {
            ownerId: 'owner-1',
            ownerName: 'ลูกค้าทดสอบ',
            ownerCode: 'C001',
            truckId: 'truck-1',
            licensePlate: '70-1234',
        };
        draft.payment.billBookNo = '3';
        draft.payment.billNo = '100';

        expect(buildSaleFlowRequest(draft, capabilities).body).toEqual({
            paymentType: 'CREDIT',
            amount: 1000,
            ownerId: 'owner-1',
            truckId: 'truck-1',
            licensePlate: '70-1234',
            bookNo: '3',
            billNo: '100',
            notes: null,
        });
    });

    it('uploads FULL transfer proof before posting the transaction', async () => {
        const capabilities = getSaleFlowCapabilities('station-1')!;
        const draft = createEmptySaleDraft(stationContext('station-1', 'FULL'), 'TRANSFER');
        draft.item = {
            kind: 'FUEL',
            productType: 'DIESEL',
            nozzleNumber: 1,
            liters: 50,
            pricePerLiter: 30.5,
            amount: 1525,
        };
        const calls: Array<{ input: string; init?: RequestInit }> = [];
        const fetchImpl: SaleFlowFetch = async (input, init) => {
            calls.push({ input, init });
            if (input === '/api/upload/transfer-proof') {
                return new Response(JSON.stringify({ url: 'https://example.com/slip.webp' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({ id: 'txn-1', amount: 1525 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        const result = await submitSaleFlowDraft({
            draft,
            capabilities,
            transferProofFile: new File(['image'], 'slip.png', { type: 'image/png' }),
            fetchImpl,
        });

        expect(result).toMatchObject({ id: 'txn-1', amount: 1525 });
        expect(calls.map((call) => call.input)).toEqual([
            '/api/upload/transfer-proof',
            '/api/station/1/transactions',
        ]);
        expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({
            paymentType: 'TRANSFER',
            transferProofUrl: 'https://example.com/slip.webp',
        });
    });

    it('does not upload transfer proof for GAS because the current API does not store it', async () => {
        const capabilities = getSaleFlowCapabilities('station-5')!;
        const draft = createEmptySaleDraft(stationContext('station-5', 'GAS'), 'TRANSFER');
        draft.item = {
            kind: 'FUEL',
            productType: 'LPG',
            nozzleNumber: null,
            liters: 62.1504,
            pricePerLiter: 16.09,
            amount: 1000,
        };
        const calls: string[] = [];
        const fetchImpl: SaleFlowFetch = async (input) => {
            calls.push(input);
            return new Response(JSON.stringify({ id: 'gas-txn-1', amount: 1000 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        await submitSaleFlowDraft({
            draft,
            capabilities,
            transferProofFile: new File(['image'], 'unused.png', { type: 'image/png' }),
            fetchImpl,
        });

        expect(calls).toEqual(['/api/v2/gas/5/sell']);
    });
});
