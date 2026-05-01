import { describe, expect, it } from 'vitest';
import {
    normalizeGasSupplyInput,
    summarizeGasSupplies,
} from '../src/lib/gas/supply-utils';

describe('gas supply utilities', () => {
    it('normalizes received gas payloads and computes missing totals', () => {
        const result = normalizeGasSupplyInput({
            dateKey: '2026-04-30',
            liters: '1,200.50',
            supplier: '  LPG Supplier  ',
            invoiceNo: ' INV-9 ',
            pricePerLiter: '12.25',
        });

        expect(result.ok).toBe(true);
        expect(result.value).toMatchObject({
            dateKey: '2026-04-30',
            liters: 1200.5,
            supplier: 'LPG Supplier',
            invoiceNo: 'INV-9',
            pricePerLiter: 12.25,
            totalCost: 14706.13,
        });
    });

    it('rejects empty or non-positive liters', () => {
        const result = normalizeGasSupplyInput({
            dateKey: '2026-04-30',
            liters: '0',
        });

        expect(result.ok).toBe(false);
        expect(result.errors[0]).toBe('กรุณาระบุจำนวนลิตรรับเข้าให้มากกว่า 0');
    });

    it('summarizes supply rows for dashboards', () => {
        expect(summarizeGasSupplies([
            { liters: 1000, totalCost: 12000 },
            { liters: 500, totalCost: null },
        ])).toEqual({
            totalLiters: 1500,
            totalCost: 12000,
            count: 2,
            averageCostPerLiter: 8,
        });
    });
});
