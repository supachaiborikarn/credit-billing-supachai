import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('S107 canonical Inventory admin parity', () => {
    it('exposes manual adjustment only to ADMIN and keeps it separate from receipt/sale history', () => {
        const source = readFileSync('src/components/stations/GasProductInventory.tsx', 'utf8');
        expect(source).toContain("context.user.role === 'ADMIN'");
        expect(source).toContain("fetch('/api/admin/inventory/adjust'");
        expect(source).toContain('ปรับยอด ±');
        expect(source).toContain('ไม่สร้างประวัติรับเข้า/ขายปลอม');
        expect(source).toContain('reason');
    });

    it('keeps low-stock visibility in the canonical inventory list including quantity zero', () => {
        const source = readFileSync('src/components/stations/GasProductInventory.tsx', 'utf8');
        expect(source).toContain('item.quantity <= item.alertLevel');
        expect(source).toContain('สินค้าใกล้หมด');
    });
});
