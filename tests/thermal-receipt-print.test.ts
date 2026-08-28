import { describe, expect, it } from 'vitest';

import { buildEpsonReceiptPrintUrl, getReceiptConfig } from '@/lib/thermal-receipt-print';

describe('thermal receipt Epson direct printing', () => {
    it('builds one ePOS job that cuts between original and copy', () => {
        const url = buildEpsonReceiptPrintUrl({
            config: getReceiptConfig('station-1')!,
            docNo: '830/41462',
            docType: 'credit',
            paperSize: '80',
            txn: {
                id: 'txn-receipt-1',
                stationId: 'station-1',
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

    it('supports 58mm cash receipts with original and copy cuts', () => {
        const url = buildEpsonReceiptPrintUrl({
            config: getReceiptConfig('station-2')!,
            docNo: '10/20',
            docType: 'receipt',
            paperSize: '58',
            txn: {
                id: 'txn-receipt-58',
                stationId: 'station-2',
                date: '2026-08-28T10:00:00+07:00',
                createdAt: '2026-08-28T10:00:00+07:00',
                licensePlate: 'กข 1234',
                ownerName: '',
                paymentType: 'CASH',
                fuelType: 'DIESEL',
                liters: 10,
                pricePerLiter: 30.34,
                amount: 303.4,
                billBookNo: '10',
                billNo: '20',
                recordedBy: { name: 'พนักงาน' },
            },
        });

        expect(url).toBeTruthy();
        const xml = decodeURIComponent(url!.split('data=')[1]);
        expect(xml).toContain('หจก.วัชรเกียรติออยล์');
        expect(xml).toContain('ใบเสร็จรับเงิน');
        expect(xml).toContain('[ ต้นฉบับ ]');
        expect(xml).toContain('[ สำเนา ]');
        expect(xml.match(/<cut type="feed" \/>/g)).toHaveLength(2);
        expect(xml).not.toContain('วันที่ลงนาม');
    });

    it('fails closed for station-3 until a verified receipt header is configured', () => {
        expect(getReceiptConfig('station-3')).toBeNull();
        expect(getReceiptConfig('station-4')?.name).toContain('ศุภชัยบริการ');
    });
});
