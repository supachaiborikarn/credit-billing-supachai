import { describe, expect, it } from 'vitest';
import {
    addToGasPaymentSummary,
    normalizeGasPaymentType,
} from '../src/lib/gas/payment-utils';
import {
    appendStaleShiftNote,
    getGasStationIds,
    isStaleGasOpenShift,
} from '../src/lib/gas/stale-shifts';
import {
    getGasStartBaselineLock,
    validateGasGaugePayload,
    validateGasMeterPayload,
} from '../src/lib/gas/v2-workflow';

describe('gas station payment contract', () => {
    it('normalizes legacy CARD payloads to Prisma CREDIT_CARD', () => {
        expect(normalizeGasPaymentType('CARD')).toBe('CREDIT_CARD');
        expect(normalizeGasPaymentType('CREDIT_CARD')).toBe('CREDIT_CARD');
        expect(normalizeGasPaymentType('TRANSFER')).toBe('TRANSFER');
        expect(normalizeGasPaymentType('CHEQUE')).toBeNull();
    });

    it('aggregates all gas payment buckets', () => {
        const summary = { cash: 0, credit: 0, card: 0, transfer: 0 };

        addToGasPaymentSummary(summary, 'CASH', 100);
        addToGasPaymentSummary(summary, 'CREDIT', 200);
        addToGasPaymentSummary(summary, 'CARD', 300);
        addToGasPaymentSummary(summary, 'TRANSFER', 400);

        expect(summary).toEqual({
            cash: 100,
            credit: 200,
            card: 300,
            transfer: 400,
        });
    });
});

describe('gas stale shift cleanup rules', () => {
    it('selects only open gas shifts before the cutoff date', () => {
        const cutoff = new Date('2026-04-23T00:00:00.000Z');
        const gasStationIds = getGasStationIds();

        expect(gasStationIds).toEqual(['station-5', 'station-6']);
        expect(isStaleGasOpenShift({
            stationId: 'station-5',
            status: 'OPEN',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(true);

        expect(isStaleGasOpenShift({
            stationId: 'station-5',
            status: 'CLOSED',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(false);

        expect(isStaleGasOpenShift({
            stationId: 'station-1',
            status: 'OPEN',
            date: new Date('2026-04-22T00:00:00.000Z'),
        }, cutoff, gasStationIds)).toBe(false);

        expect(isStaleGasOpenShift({
            stationId: 'station-6',
            status: 'OPEN',
            date: cutoff,
        }, cutoff, gasStationIds)).toBe(false);
    });

    it('appends cleanup audit context without losing the existing note', () => {
        expect(appendStaleShiftNote('old note', 'cleanup')).toBe('old note | cleanup');
        expect(appendStaleShiftNote(null, 'cleanup')).toBe('cleanup');
    });
});

describe('gas v2 workflow guards', () => {
    it('validates exact nozzle payloads for shift open and meter writes', () => {
        const valid = validateGasMeterPayload([
            { nozzleNumber: 1, reading: 1000 },
            { nozzleNumber: 2, reading: 1001 },
            { nozzleNumber: 3, reading: 1002 },
            { nozzleNumber: 4, reading: 1003 },
        ]);
        const invalid = validateGasMeterPayload([
            { nozzleNumber: 1, reading: 1000 },
            { nozzleNumber: 1, reading: 1001 },
            { nozzleNumber: 3, reading: -5 },
        ]);

        expect(valid.ok).toBe(true);
        expect(valid.value.map((item) => item.nozzleNumber)).toEqual([1, 2, 3, 4]);
        expect(invalid.ok).toBe(false);
        expect(invalid.errors.some((error) => error.includes('หัวจ่าย 1 ถูกส่งซ้ำ'))).toBe(true);
    });

    it('validates exact tank payloads and percentage bounds', () => {
        const valid = validateGasGaugePayload([
            { tankNumber: 1, percentage: 45 },
            { tankNumber: 2, percentage: 55 },
            { tankNumber: 3, percentage: 65 },
        ]);
        const invalid = validateGasGaugePayload([
            { tankNumber: 1, percentage: 45 },
            { tankNumber: 2, percentage: 101 },
            { tankNumber: 2, percentage: 30 },
        ]);

        expect(valid.ok).toBe(true);
        expect(valid.value.map((item) => item.tankNumber)).toEqual([1, 2, 3]);
        expect(invalid.ok).toBe(false);
        expect(invalid.errors.some((error) => error.includes('เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100'))).toBe(true);
    });

    it('locks start baseline edits once a shift has started being used', () => {
        expect(getGasStartBaselineLock({
            shiftStatus: 'OPEN',
            transactionCount: 0,
            hasEndMeters: false,
            hasEndGauges: false,
            hasReconciliation: false,
        })).toEqual({ locked: false, reason: null });

        expect(getGasStartBaselineLock({
            shiftStatus: 'OPEN',
            transactionCount: 1,
            hasEndMeters: false,
            hasEndGauges: false,
            hasReconciliation: false,
        })).toEqual({
            locked: true,
            reason: 'กะนี้เริ่มมีรายการขายแล้ว',
        });

        expect(getGasStartBaselineLock({
            shiftStatus: 'CLOSED',
            transactionCount: 0,
            hasEndMeters: false,
            hasEndGauges: false,
            hasReconciliation: false,
        })).toEqual({
            locked: true,
            reason: 'แก้ค่าเริ่มกะได้เฉพาะกะที่เปิดอยู่',
        });
    });
});
