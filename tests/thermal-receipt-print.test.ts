import { describe, expect, it } from 'vitest';

import { buildEpsonReceiptPrintUrl, RECEIPT_CONFIG } from '@/lib/thermal-receipt-print';

describe('thermal receipt Epson direct printing', () => {
    it('builds one ePOS job that cuts between original and copy', () => {
        const url = buildEpsonReceiptPrintUrl({
            config: RECEIPT_CONFIG['station-1'],
            docNo: '830/41462',
            docType: 'credit',
            paperSize: '80',
            txn: {
                id: 'txn-receipt-1',
                date: '2026-05-03T14:00:00+07:00',
                createdAt: '2026-05-03T14:00:00+07:00',
                licensePlate: 'บย 0114',
                ownerName: 'นาย ก. ชาวนา',
                paymentType: 'CREDIT',
                fuelType: 'DIESEL',
                liters: 200,
                pricePerLiter: 41.2,
                amount: 8240,
                billBookNo: '830',
                billNo: '41462',
                recordedBy: { name: 'พนักงาน' },
            },
        });

        expect(url).toBeTruthy();
        expect(url).toContain('tmprintassistant://tmprintassistant.epson.com/print');
        expect(url).toContain('data-type=eposprintxml');

        const xml = decodeURIComponent(url!.split('data=')[1]);
        expect(xml).toMatch(/<text align="left">\s+\[ ต้นฉบับ \]/);
        expect(xml).toContain('[ ต้นฉบับ ]');
        expect(xml).toContain('[ สำเนา ]');
        expect(xml).toContain('วัชรเกียรติออยล์');
        expect(xml).toContain('บิลเงินเชื่อ / ใบส่งของ');
        expect(xml).toContain('รวมลิตร');
        expect(xml).toContain('200.00 ลิตร');
        expect(xml.match(/<cut type="feed" \/>/g)).toHaveLength(2);
        expect(xml).not.toContain('@page');
        expect(xml).not.toContain('A4');
    });
});
