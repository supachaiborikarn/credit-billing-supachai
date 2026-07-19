import { describe, expect, it } from 'vitest';

import {
    assessTankLoyAutoPrintReadiness,
    buildTankLoyAutoPrintResponse,
    getPreviousBangkokDate,
    validateAutoPrintDate,
} from '@/lib/tank-loy-auto-print';

function buildMeters({ endReading = 1_100 }: { endReading?: number | null } = {}) {
    return [1, 2, 3, 4].map(nozzleNumber => ({
        nozzleNumber,
        startReading: 1_000 + nozzleNumber,
        endReading: endReading == null ? null : endReading + nozzleNumber,
        startPhoto: `start-${nozzleNumber}.webp`,
        endPhoto: endReading == null ? null : `end-${nozzleNumber}.webp`,
        shiftId: 'shift-1',
    }));
}

describe('Tank Loy automatic daily printing', () => {
    it('uses yesterday in Bangkok even when UTC is still on the previous date', () => {
        expect(getPreviousBangkokDate(new Date('2026-07-18T18:00:00.000Z'))).toBe('2026-07-18');
        expect(getPreviousBangkokDate(new Date('2026-01-01T00:30:00.000Z'))).toBe('2025-12-31');
    });

    it('accepts real dates and rejects normalized or malformed dates', () => {
        expect(validateAutoPrintDate('2026-07-18')).toBe(true);
        expect(validateAutoPrintDate('2026-02-31')).toBe(false);
        expect(validateAutoPrintDate('18-07-2026')).toBe(false);
    });

    it('waits until all four opening and closing readings are complete', () => {
        const incompleteMeters = buildMeters({ endReading: null });
        const reasons = assessTankLoyAutoPrintReadiness(incompleteMeters);

        expect(reasons).toEqual(['ยังไม่มีเลขปิดมิเตอร์หัว 1, 2, 3, 4']);
    });

    it('builds an 80mm ePOS report from station-wide daily data', () => {
        const meters = buildMeters();
        const response = buildTankLoyAutoPrintResponse({
            reportDate: '2026-07-18',
            dailyRecord: {
                meters,
                shifts: [{
                    id: 'shift-1',
                    shiftNumber: 1,
                    status: 'CLOSED',
                    createdAt: new Date('2026-07-17T23:00:00.000Z'),
                    meters,
                    _count: { transactions: 1 },
                }],
            },
            transactions: [{
                id: 'transaction-1',
                date: '2026-07-18T09:00:00+07:00',
                licensePlate: 'กข 1234',
                ownerName: 'ลูกค้าทดสอบ',
                paymentType: 'CASH',
                liters: 100,
                amount: 3_134,
            }],
        });

        expect(response.ready).toBe(true);
        expect(response.jobId).toBe('station-1:2026-07-18');
        expect(response.paperSize).toBe('80');
        expect(response.transactionCount).toBe(1);
        expect(response.meterCount).toBe(4);
        expect(response.xml).toContain('<epos-print');
        expect(response.xml).toContain('กข 1234');
        expect(response.xml).toContain('<cut type="feed" />');
    });

    it('does not create print XML when the day has no record', () => {
        const response = buildTankLoyAutoPrintResponse({
            reportDate: '2026-07-18',
            dailyRecord: null,
            transactions: [],
        });

        expect(response.ready).toBe(false);
        expect(response.xml).toBeNull();
        expect(response.reasons[0]).toContain('2026-07-18');
    });
});
