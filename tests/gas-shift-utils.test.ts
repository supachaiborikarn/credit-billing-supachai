import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getCurrentShiftNumber,
    getGasBusinessDateKey,
    getShiftName,
    getShiftTimeRangeLabel,
    SHIFTS,
} from '../src/lib/gas';

afterEach(() => {
    vi.useRealTimers();
});

describe('gas shift utilities', () => {
    it('defines GAS shifts as 07:00-19:00 and 19:00-07:00', () => {
        expect(SHIFTS[1]).toMatchObject({
            startHour: 7,
            endHour: 19,
        });
        expect(SHIFTS[2]).toMatchObject({
            startHour: 19,
            endHour: 7,
        });
        expect(getShiftTimeRangeLabel(1)).toBe('07:00-19:00');
        expect(getShiftTimeRangeLabel(2)).toBe('19:00-07:00');
        expect(getShiftName(1)).toBe('กะ 1 (07:00-19:00)');
        expect(getShiftName(2)).toBe('กะ 2 (19:00-07:00)');
    });

    it('chooses the current shift from Bangkok time', () => {
        vi.useFakeTimers();

        vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z')); // 07:00 Bangkok
        expect(getCurrentShiftNumber()).toBe(1);

        vi.setSystemTime(new Date('2026-05-12T11:59:00.000Z')); // 18:59 Bangkok
        expect(getCurrentShiftNumber()).toBe(1);

        vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z')); // 19:00 Bangkok
        expect(getCurrentShiftNumber()).toBe(2);

        vi.setSystemTime(new Date('2026-05-12T23:59:00.000Z')); // 06:59 Bangkok
        expect(getCurrentShiftNumber()).toBe(2);
    });

    it('keeps 00:00-06:59 on the previous GAS business date', () => {
        expect(getGasBusinessDateKey(new Date('2026-05-11T23:59:00.000Z'))).toBe('2026-05-11');
        expect(getGasBusinessDateKey(new Date('2026-05-12T00:00:00.000Z'))).toBe('2026-05-12');
        expect(getGasBusinessDateKey(new Date('2026-05-12T12:00:00.000Z'))).toBe('2026-05-12');
    });
});
