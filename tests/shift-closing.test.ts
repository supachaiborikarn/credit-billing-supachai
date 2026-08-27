import { describe, expect, it, vi } from 'vitest';
import {
    calculateFullClosingPreview,
    calculateGasClosingPreview,
    closeFullStationShift,
    closeGasStationShift,
    previewClosingAnomalies,
    saveFullClosingMeters,
    saveGasClosingReadings,
    validateFullClosingMeters,
    validateGasClosingReadings,
    type ClosingMeterInput,
    type ClosingProductInput,
    type FullClosingCashInput,
    type GasClosingMoneyInput,
} from '@/lib/stations/shift-closing';

function okJson(payload: unknown = { success: true }) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function fullMeters(): ClosingMeterInput[] {
    return [1, 2, 3, 4].map((number) => ({
        number,
        startReading: 1000 * number,
        value: String(1000 * number + 10),
        price: 30,
        file: new File([`end-${number}`], `end-${number}.jpg`, { type: 'image/jpeg' }),
    }));
}

function gasMeters(): ClosingMeterInput[] {
    return [1, 2, 3, 4].map((number) => ({
        number,
        startReading: 2000 * number,
        value: String(2000 * number + 10),
    }));
}

const fullCash: FullClosingCashInput = {
    cashReceived: '1000',
    creditExpected: 200,
    cardReceived: '0',
    transferReceived: '0',
    expenses: '0',
    expenseNote: '',
    discounts: '0',
    discountNote: '',
};

const gasMoney: GasClosingMoneyInput = {
    cashReceived: '600',
    creditReceived: '0',
    cardReceived: '0',
    transferReceived: '0',
    productTransferAmount: '0',
    otherIncomeAmount: '0',
    otherIncomeNote: '',
    otherExpensesAmount: '0',
    otherExpenseNote: '',
    varianceNote: '',
};

describe('shift closing validation', () => {
    it('FULL requires four end meters that do not go backwards and image evidence', () => {
        expect(validateFullClosingMeters(fullMeters())).toEqual({ valid: true, errors: [] });

        const invalid = fullMeters();
        invalid[1].value = '100';
        invalid[2].file = null;
        expect(validateFullClosingMeters(invalid)).toMatchObject({ valid: false });
    });

    it('FULL accepts an existing end photo on retry without forcing another upload', () => {
        const retry = fullMeters();
        retry[0].file = null;
        retry[0].existingPhoto = 'https://example.test/existing.webp';
        expect(validateFullClosingMeters(retry)).toEqual({ valid: true, errors: [] });
    });

    it('GAS requires exactly four end meters and three gauges in range', () => {
        const gauges = [1, 2, 3].map((number) => ({ number, value: '50' }));
        expect(validateGasClosingReadings(gasMeters(), gauges)).toEqual({ valid: true, errors: [] });
        gauges[2].value = '101';
        expect(validateGasClosingReadings(gasMeters(), gauges)).toMatchObject({ valid: false });
    });
});

describe('shift closing reconciliation previews', () => {
    it('FULL follows legacy expected-minus-received thresholds', () => {
        const preview = calculateFullClosingPreview(fullMeters(), fullCash);
        expect(preview.totalLiters).toBe(40);
        expect(preview.totalExpected).toBe(1200);
        expect(preview.totalReceived).toBe(1200);
        expect(preview.variance).toBe(0);
        expect(preview.varianceStatus).toBe('GREEN');

        const red = calculateFullClosingPreview(fullMeters(), { ...fullCash, cashReceived: '0', creditExpected: 0 });
        expect(red.variance).toBe(1200);
        expect(red.varianceStatus).toBe('RED');
    });

    it('GAS includes product stock, other income and expenses using received-minus-expected', () => {
        const products: ClosingProductInput[] = [{
            productId: 'p1', name: 'น้ำ', salePrice: 20, openingQty: 10, received: '2', closingQty: '7',
        }];
        const preview = calculateGasClosingPreview({
            meters: gasMeters(),
            gasPrice: 10,
            products,
            money: { ...gasMoney, cashReceived: '510', otherIncomeAmount: '20', otherExpensesAmount: '10' },
        });
        expect(preview.totalLiters).toBe(40);
        expect(preview.productSalesAmount).toBe(100);
        expect(preview.expectedOtherAmount).toBe(110);
        expect(preview.totalExpected).toBe(510);
        expect(preview.totalReceived).toBe(510);
        expect(preview.variance).toBe(0);
        expect(preview.varianceStatus).toBe('GREEN');
    });
});

describe('shift closing API adapters', () => {
    it('FULL uploads end evidence, saves all meters, then calls the existing close API', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            calls.push({ url, init });
            if (url === '/api/upload/meter-photo') {
                const body = init?.body as FormData;
                return okJson({ url: `https://example.test/end-${body.get('nozzle')}.webp` });
            }
            return okJson();
        }) as typeof fetch;

        const meters = fullMeters();
        await saveFullClosingMeters({
            stationId: 'station-1', stationNumber: 1, shiftId: 'full-shift', businessDate: '2026-08-27', meters, fetchImpl,
        });
        await closeFullStationShift({ stationNumber: 1, shiftId: 'full-shift', meters, cash: fullCash, anomalyNote: 'checked', fetchImpl });

        expect(calls.map((call) => call.url)).toEqual([
            '/api/upload/meter-photo', '/api/upload/meter-photo', '/api/upload/meter-photo', '/api/upload/meter-photo',
            '/api/station/1/meters', '/api/station/1/shift-end',
        ]);
        expect(JSON.parse(String(calls[4].init?.body))).toMatchObject({
            date: '2026-08-27', shiftId: 'full-shift', type: 'end',
        });
        expect(JSON.parse(String(calls[5].init?.body))).toMatchObject({
            shiftId: 'full-shift', products: [], anomalyNote: 'checked',
        });
    });

    it('GAS saves end meters and gauges before calling the atomic reconciliation close API', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), init });
            return okJson();
        }) as typeof fetch;
        const meters = gasMeters();
        const gauges = [1, 2, 3].map((number) => ({ number, value: String(50 + number) }));

        await saveGasClosingReadings({ stationNumber: 6, shiftId: 'gas-shift', meters, gauges, fetchImpl });
        await closeGasStationShift({ stationNumber: 6, shiftId: 'gas-shift', products: [], money: gasMoney, fetchImpl });

        expect(calls.map((call) => call.url)).toEqual([
            '/api/v2/gas/6/meters', '/api/v2/gas/6/gauge', '/api/v2/gas/6/shift/close',
        ]);
        expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ shiftId: 'gas-shift', type: 'end' });
        expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({ shiftId: 'gas-shift', type: 'end' });
        expect(JSON.parse(String(calls[2].init?.body))).toEqual({
            shiftId: 'gas-shift',
            reconciliation: {
                cashReceived: 600, creditReceived: 0, cardReceived: 0, transferReceived: 0,
                products: [], productTransferAmount: 0,
                otherIncomeAmount: 0, otherIncomeNote: '',
                otherExpensesAmount: 0, otherExpenseNote: '', varianceNote: '',
            },
        });
    });

    it('uses the existing anomaly preview endpoint before confirmation', async () => {
        const fetchImpl = vi.fn(async () => okJson({ hasAnomalies: false, anomalies: [], requiresNote: false })) as typeof fetch;
        const result = await previewClosingAnomalies({ stationNumber: 1, shiftId: 'full-shift', meters: fullMeters(), fetchImpl });
        expect(result).toEqual({ hasAnomalies: false, anomalies: [], requiresNote: false });
        expect(fetchImpl).toHaveBeenCalledWith('/api/gas-station/1/shifts/full-shift/anomalies', expect.objectContaining({ method: 'POST' }));
    });
});
