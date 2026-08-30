import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT_INVENTORY_STATION_IDS, isProductInventoryStationId } from '../src/lib/inventory-scope';

describe('S121 retired inventory surface and station scope', () => {
    it('keeps product inventory scoped to configured hasProducts stations', () => {
        expect(PRODUCT_INVENTORY_STATION_IDS).toEqual(['station-5']);
        expect(isProductInventoryStationId('station-5')).toBe(true);
        expect(isProductInventoryStationId('station-6')).toBe(false);
        expect(isProductInventoryStationId('station-2')).toBe(false);
    });

    it.each(['src/app/admin/inventory/page.tsx', 'src/app/admin/low-stock/page.tsx'])('%s is redirect-only defense in depth', (file) => {
        const source = readFileSync(file, 'utf8');
        expect(source).toContain("redirect('/stations/station-5/inventory')");
        expect(source).not.toContain("'use client'");
        expect(source).not.toContain('fetch(');
    });
});
