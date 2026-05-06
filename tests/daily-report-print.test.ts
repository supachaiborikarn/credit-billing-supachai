import { describe, expect, it } from 'vitest';

import { buildEpsonAssistantDailyReportUrl } from '@/lib/daily-report-print';

describe('daily report thermal printing', () => {
    it('builds an Epson TM Print Assistant ePOS XML URL for Android direct printing', () => {
        const url = buildEpsonAssistantDailyReportUrl({
            stationName: 'แท๊งลอยวัชรเกียรติ',
            reportDate: '2026-05-03',
            paperSize: '80',
            meters: [
                {
                    nozzleNumber: 1,
                    fuelType: 'ดีเซล B7',
                    startReading: 1000,
                    endReading: 1100,
                },
            ],
            transactions: [
                {
                    id: 'txn-1',
                    date: '2026-05-03T09:30:00+07:00',
                    licensePlate: 'กข 1234',
                    ownerName: 'ลูกค้าเงินสด',
                    paymentType: 'CASH',
                    fuelType: 'DIESEL_B7',
                    liters: 100,
                    amount: 4120,
                    billBookNo: '01',
                    billNo: '0001',
                },
            ],
        });

        expect(url).toBeTruthy();
        expect(url).toContain('tmprintassistant://tmprintassistant.epson.com/print');
        expect(url).toContain('data-type=eposprintxml');

        const xml = decodeURIComponent(url!.split('data=')[1]);
        expect(xml).toContain('<epos-print');
        expect(xml).toContain('<text lang="mul" />');
        expect(xml).toContain('<text font="font_b" />');
        expect(xml).not.toContain('width="2" height="2"');
        expect(xml).toContain('เลขเปิด-ปิดมิเตอร์');
        expect(xml).toContain('ผลต่าง');
        expect(xml).toContain('หัว 1 ดีเซล B7');
        expect(xml).toContain('เปิด 1,000.00');
        expect(xml).toContain('ปิด  1,100.00');
        expect(xml).toContain('รายงานสรุปวัน');
        expect(xml).toContain('แท๊งลอยวัชรเกียรติ');
        expect(xml).toContain('<cut type="feed" />');
        expect(xml).not.toContain('@page');
        expect(xml).not.toContain('A4');
    });
});
